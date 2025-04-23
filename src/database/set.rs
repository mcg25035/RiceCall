use crate::utils::standaruduzed_error::StandardizedError;
use crate::models::accounts::Accounts;
use crate::database::database_utils::validate_data;
use std::collections::HashMap;

pub fn set_accout(account: String, data: Accounts) -> Result<(), StandardizedError> {
    let mut set_data = HashMap::new();
    set_data.insert("account".to_string(), account);
    set_data.insert("password".to_string(), data.password);
    set_data.insert("user_id".to_string(), data.user_id.to_string());

    let allowed_fields = vec!["password", "user_id"];
    let (valid_fields, invalid_fields) = validate_data(set_data, &allowed_fields)?;

    if !invalid_fields.is_empty() {
        return Err(StandardizedError::new(
            &format!("Invalid fields: {:?}", invalid_fields),
            "set_account",
            "database",
            "set",
            400,
            "Bad Request",
        ));
    }

    // Proceed with the database operation using valid_fields
    Ok(())
}