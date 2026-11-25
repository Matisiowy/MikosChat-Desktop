use keyring::{Entry, Error};

const SERVICE: &str = "pl.mikrusmusic.mikoschat.desktop";
const ACCOUNT: &str = "refresh-token";

fn entry() -> Result<Entry, String> {
    Entry::new(SERVICE, ACCOUNT).map_err(|_| "Credential store unavailable".to_string())
}

pub fn save(token: &str) -> Result<(), String> {
    entry()?
        .set_password(token)
        .map_err(|_| "Could not save session".to_string())
}

pub fn load() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(token) => Ok(Some(token)),
        Err(Error::NoEntry) => Ok(None),
        Err(_) => Err("Could not read session".to_string()),
    }
}

pub fn clear() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err("Could not remove session".to_string()),
    }
}
