use std::collections::HashMap;
use regex::Regex;

use crate::utils::standaruduzed_error::StandardizedError;

pub fn camel_to_snake(input_str: &str) -> String {
    let re = Regex::new(r"(?P<upper>[A-Z])").unwrap();
    return input_str
        .chars()
        .enumerate()
        .map(|(i, c)| {
            if re.is_match(&c.to_string()) && i != 0 {
                format!("_{}", c.to_lowercase())
            } else {
                c.to_string()
            }
        })
        .collect::<String>()
        .to_lowercase();
}

pub fn snake_to_camel(input_str: &str) -> String {
    let mut result = String::new();
    let mut capitalize_next = false;

    for c in input_str.chars() {
        if c == '_' {
            capitalize_next = true;
        } else {
            if capitalize_next {
                result.push(c.to_ascii_uppercase());
                capitalize_next = false;
            } else {
                result.push(c);
            }
        }
    }

    return result;
}

pub fn convert_to_snake_case(data: HashMap<String, String>) -> HashMap<String, String> {
    let mut new_data = HashMap::new();
    for (key, value) in data.iter() {
        let new_key = camel_to_snake(key);
        new_data.insert(new_key, value.clone());
    }
    return new_data;
}

pub fn convert_to_camel_case(data: HashMap<String, String>) -> HashMap<String, String> {
    let mut new_data = HashMap::new();
    for (key, value) in data.iter() {
        let new_key = snake_to_camel(key);
        new_data.insert(new_key, value.clone());
    }
    return new_data;
}

pub fn validate_data(data: HashMap<String, String>, allowed_fields: &[&str]) -> Result<(Vec<String>, Vec<String>), StandardizedError> {
    let converted_data: HashMap<String, String> = convert_to_snake_case(data);
    let keys = converted_data
    .keys()
    .filter(|key| allowed_fields.contains(&key.as_str()))
    .map(|key| key.to_string())
    .collect::<Vec<String>>();

    let values: Vec<String> = keys
    .iter()
    .map(|key| converted_data.get(key).unwrap().clone())
    .collect();

    if keys.len() == 0 || values.len() == 0 {
        return Err(StandardizedError::new(
            "No fields to update",
            "AccessDatabaseError",
            "SET",
            "DATA_INVALID",
            401,
            "Error"
        ));
    }

    if keys.len() != values.len() {
        return Err(StandardizedError::new(
            "Keys and Values length mismatch",
            "AccessDatabaseError",
            "SET",
            "DATA_INVALID",
            401,
            "Error"
        ));
    }

    return Ok((keys, values));
}