use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::time::Duration;
use tauri::State;
use tokio::sync::Mutex;

use crate::credentials;

const API: &str = "https://api.chat.mikrusmusic.pl/api/v1";

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthError {
    status: u16,
    message: String,
}

impl AuthError {
    fn local(message: impl Into<String>) -> Self {
        Self {
            status: 0,
            message: message.into(),
        }
    }

    fn unauthorized() -> Self {
        Self {
            status: 401,
            message: "Session expired".into(),
        }
    }
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ServerSession {
    user: Option<Value>,
    access_token: String,
    refresh_token: String,
    session_id: String,
    expires_in: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSession {
    user: Value,
    access_token: String,
    session_id: String,
    expires_in: u64,
}

#[derive(Default)]
struct Session {
    refresh_token: Option<String>,
    access_token: Option<String>,
    remember: bool,
}

pub struct AuthState {
    client: Client,
    session: Mutex<Session>,
}

impl AuthState {
    pub fn new() -> Result<Self, reqwest::Error> {
        let client = Client::builder()
            .timeout(Duration::from_secs(20))
            .redirect(reqwest::redirect::Policy::none())
            .https_only(true)
            .build()?;

        Ok(Self {
            client,
            session: Mutex::new(Session::default()),
        })
    }
}

async fn check_response(response: reqwest::Response) -> Result<reqwest::Response, AuthError> {
    let status = response.status();

    if status.is_success() {
        return Ok(response);
    }

    let message = match status {
        StatusCode::UNAUTHORIZED => "Invalid credentials or expired session",
        StatusCode::TOO_MANY_REQUESTS => "Too many requests",
        StatusCode::CONFLICT => "Account already exists",
        StatusCode::BAD_REQUEST => "Invalid request",
        _ => "Server request failed",
    };

    Err(AuthError {
        status: status.as_u16(),
        message: message.into(),
    })
}

async fn request_session(
    client: &Client,
    path: &str,
    body: Value,
) -> Result<ServerSession, AuthError> {
    let response = client
        .post(format!("{API}{path}"))
        .json(&body)
        .send()
        .await
        .map_err(|_| AuthError::local("Server unavailable"))?;

    check_response(response)
        .await?
        .json::<ServerSession>()
        .await
        .map_err(|_| AuthError::local("Invalid server response"))
}

async fn revoke(client: &Client, access_token: &str) -> Result<(), AuthError> {
    let response = client
        .post(format!("{API}/auth/logout"))
        .bearer_auth(access_token)
        .send()
        .await
        .map_err(|_| AuthError::local("Server unavailable"))?;

    check_response(response).await?;

    Ok(())
}

async fn install_session(
    client: &Client,
    current: &mut Session,
    incoming: ServerSession,
    remember: bool,
) -> Result<PublicSession, AuthError> {
    let storage = if remember {
        credentials::save(&incoming.refresh_token)
    } else {
        credentials::clear()
    };

    if let Err(error) = storage {
        let _ = revoke(client, &incoming.access_token).await;
        *current = Session::default();
        return Err(AuthError::local(error));
    }

    current.refresh_token = Some(incoming.refresh_token);
    current.access_token = Some(incoming.access_token.clone());
    current.remember = remember;

    let user = match incoming.user {
        Some(user) => user,
        None => {
            let response = client
                .get(format!("{API}/auth/me"))
                .bearer_auth(&incoming.access_token)
                .send()
                .await
                .map_err(|_| AuthError::local("Server unavailable"))?;

            check_response(response)
                .await?
                .json::<Value>()
                .await
                .map_err(|_| AuthError::local("Invalid user response"))?
        }
    };

    Ok(PublicSession {
        user,
        access_token: incoming.access_token,
        session_id: incoming.session_id,
        expires_in: incoming.expires_in,
    })
}

#[tauri::command]
pub async fn auth_login(
    state: State<'_, AuthState>,
    identifier: String,
    password: String,
    remember: bool,
) -> Result<PublicSession, AuthError> {
    let mut current = state.session.lock().await;

    let incoming = request_session(
        &state.client,
        "/auth/login",
        json!({
            "identifier": identifier,
            "password": password,
            "deviceName": "MikosChat Desktop (Windows)"
        }),
    )
    .await?;

    install_session(&state.client, &mut current, incoming, remember).await
}

#[tauri::command]
pub async fn auth_register(
    state: State<'_, AuthState>,
    username: String,
    email: String,
    display_name: String,
    password: String,
    remember: bool,
) -> Result<PublicSession, AuthError> {
    let mut current = state.session.lock().await;

    let incoming = request_session(
        &state.client,
        "/auth/register",
        json!({
            "username": username,
            "email": email,
            "displayName": display_name,
            "password": password
        }),
    )
    .await?;

    install_session(&state.client, &mut current, incoming, remember).await
}

async fn refresh_locked(
    client: &Client,
    current: &mut Session,
) -> Result<PublicSession, AuthError> {
    let token = match current.refresh_token.clone() {
        Some(token) => token,
        None => {
            let token = credentials::load()
                .map_err(AuthError::local)?
                .ok_or_else(AuthError::unauthorized)?;

            current.remember = true;
            token
        }
    };

    let incoming =
        match request_session(client, "/auth/refresh", json!({ "refreshToken": token })).await {
            Ok(session) => session,
            Err(error) => {
                if error.status == 401 {
                    *current = Session::default();
                    credentials::clear().map_err(AuthError::local)?;
                }

                return Err(error);
            }
        };

    let remember = current.remember;

    install_session(client, current, incoming, remember).await
}

#[tauri::command]
pub async fn auth_refresh(state: State<'_, AuthState>) -> Result<PublicSession, AuthError> {
    let mut current = state.session.lock().await;

    refresh_locked(&state.client, &mut current).await
}

#[tauri::command]
pub async fn auth_logout(state: State<'_, AuthState>) -> Result<(), AuthError> {
    let mut current = state.session.lock().await;

    let token = match current.access_token.clone() {
        Some(token) => Some(token),
        None => match refresh_locked(&state.client, &mut current).await {
            Ok(session) => Some(session.access_token),
            Err(error) if error.status == 401 => None,
            Err(error) => return Err(error),
        },
    };

    if let Some(token) = token {
        match revoke(&state.client, &token).await {
            Ok(()) => {}
            Err(error) if error.status == 401 => {
                match refresh_locked(&state.client, &mut current).await {
                    Ok(session) => {
                        revoke(&state.client, &session.access_token).await?;
                    }
                    Err(error) if error.status == 401 => {}
                    Err(error) => return Err(error),
                }
            }
            Err(error) => return Err(error),
        }
    }

    credentials::clear().map_err(AuthError::local)?;

    *current = Session::default();

    Ok(())
}
