// Semantic string generators
// Generates context-aware strings based on property names

use super::RandomGenerator;

// Data pools for semantic generation
const FIRST_NAMES: &[&str] = &[
    "Alice", "Bob", "Charlie", "Diana", "Eve", "Frank", "Grace", "Henry", "Iris", "Jack",
];

const LAST_NAMES: &[&str] = &[
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Wilson",
    "Moore",
];

const DOMAINS: &[&str] = &["example.com", "test.org", "mock.dev", "demo.io", "sample.net"];

const CITIES: &[&str] = &[
    "Moscow", "London", "New York", "Tokyo", "Berlin", "Paris", "Sydney", "Toronto",
];

const COUNTRIES: &[&str] = &[
    "Russia", "UK", "USA", "Japan", "Germany", "France", "Australia", "Canada",
];

const STREETS: &[&str] = &["Main", "Oak", "Elm", "Park", "Cedar", "Maple", "Pine", "Birch"];

const TITLES: &[&str] = &[
    "Getting Started",
    "Advanced Guide",
    "Quick Reference",
    "Best Practices",
    "Tutorial",
    "Documentation",
];

const LOREM: &[&str] = &[
    "Lorem ipsum dolor sit amet, consectetur adipiscing elit.",
    "Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.",
    "Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris.",
    "Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore.",
];

const URL_PATHS: &[&str] = &[
    "about", "docs", "api/v1", "products", "users", "settings", "profile", "dashboard",
];

const COLORS: &[&str] = &[
    "#FF5733", "#33FF57", "#3357FF", "#F333FF", "#FF33A8", "#33FFF5", "#F5FF33", "#FF8C33",
];

const STRING_POOL: &[&str] = &[
    "Lorem ipsum",
    "Hello World",
    "Foo Bar",
    "Test Value",
    "Sample Data",
    "Mock String",
];

/// Generate context-aware string based on property name
pub fn string_for_property(rng: &mut RandomGenerator, property_name: &str) -> String {
    let name_lower = property_name.to_lowercase();

    // Email patterns
    if name_lower.contains("email") || name_lower.ends_with("email") {
        return email(rng);
    }

    // URL patterns
    if name_lower.contains("url")
        || name_lower.contains("href")
        || name_lower.contains("link")
        || name_lower.contains("website")
    {
        return url(rng);
    }

    // Phone patterns
    if name_lower.contains("phone") || name_lower.contains("tel") || name_lower.contains("mobile")
    {
        return phone(rng);
    }

    // ID patterns
    if name_lower == "id"
        || name_lower.ends_with("id")
        || name_lower.ends_with("_id")
        || name_lower.contains("uuid")
    {
        return uuid(rng);
    }

    // Name patterns
    if name_lower == "name" || name_lower.contains("name") {
        if name_lower.contains("first") {
            return rng.pick(FIRST_NAMES).to_string();
        }
        if name_lower.contains("last") {
            return rng.pick(LAST_NAMES).to_string();
        }
        return person_name(rng);
    }

    // Title patterns
    if name_lower == "title" || name_lower.contains("title") || name_lower.contains("heading") {
        return rng.pick(TITLES).to_string();
    }

    // Description/content patterns
    if name_lower.contains("description")
        || name_lower.contains("content")
        || name_lower.contains("body")
        || name_lower.contains("text")
        || name_lower.contains("message")
    {
        return rng.pick(LOREM).to_string();
    }

    // Address patterns
    if name_lower.contains("address") || name_lower.contains("street") {
        return address(rng);
    }

    // City patterns
    if name_lower.contains("city") || name_lower.contains("town") {
        return rng.pick(CITIES).to_string();
    }

    // Country patterns
    if name_lower.contains("country") {
        return rng.pick(COUNTRIES).to_string();
    }

    // Zip/postal code patterns
    if name_lower.contains("zip") || name_lower.contains("postal") {
        return format!("{:06}", rng.number(Some(100000), Some(999999)));
    }

    // Color patterns
    if name_lower.contains("color") || name_lower.contains("colour") {
        return rng.pick(COLORS).to_string();
    }

    // Default: random from pool
    rng.pick(STRING_POOL).to_string()
}

/// Generate email address
pub fn email(rng: &mut RandomGenerator) -> String {
    let first = rng.pick(FIRST_NAMES).to_lowercase();
    let last = rng.pick(LAST_NAMES).to_lowercase();
    let domain = rng.pick(DOMAINS).to_string();
    format!("{}_{}@{}", first, last, domain)
}

/// Generate URL
pub fn url(rng: &mut RandomGenerator) -> String {
    let domain = rng.pick(DOMAINS).to_string();
    let path = rng.pick(URL_PATHS).to_string();
    format!("https://{}/{}", domain, path)
}

/// Generate phone number
pub fn phone(rng: &mut RandomGenerator) -> String {
    format!(
        "+7 {:03} {:03}-{:02}-{:02}",
        rng.number(Some(900), Some(999)),
        rng.number(Some(100), Some(999)),
        rng.number(Some(10), Some(99)),
        rng.number(Some(10), Some(99))
    )
}

/// Generate UUID v4
pub fn uuid(rng: &mut RandomGenerator) -> String {
    let hex_chars = "0123456789abcdef";
    let mut result = String::with_capacity(36);

    for i in 0..36 {
        if i == 8 || i == 13 || i == 18 || i == 23 {
            result.push('-');
        } else if i == 14 {
            result.push('4'); // Version 4
        } else if i == 19 {
            let variant = rng.number(Some(0), Some(4));
            result.push(match variant {
                0 => '8',
                1 => '9',
                2 => 'a',
                3 => 'b',
                _ => '8',
            });
        } else {
            let idx = rng.number(Some(0), Some(16)) as usize;
            result.push(hex_chars.as_bytes()[idx] as char);
        }
    }

    result
}

/// Generate person name (first + last)
pub fn person_name(rng: &mut RandomGenerator) -> String {
    let first = rng.pick(FIRST_NAMES).to_string();
    let last = rng.pick(LAST_NAMES).to_string();
    format!("{} {}", first, last)
}

/// Generate street address
pub fn address(rng: &mut RandomGenerator) -> String {
    let number = rng.number(Some(1), Some(9999));
    let street = rng.pick(STREETS).to_string();
    format!("{} {} St", number, street)
}

/// Generate city name
pub fn city(rng: &mut RandomGenerator) -> String {
    rng.pick(CITIES).to_string()
}

/// Generate country name
pub fn country(rng: &mut RandomGenerator) -> String {
    rng.pick(COUNTRIES).to_string()
}

/// Generate color hex code
pub fn color(rng: &mut RandomGenerator) -> String {
    rng.pick(COLORS).to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_email_format() {
        let mut rng = RandomGenerator::new(Some(42));
        let email_addr = email(&mut rng);

        assert!(email_addr.contains("@"));
        assert!(email_addr.contains("_"));
        assert!(email_addr.len() > 10);
    }

    #[test]
    fn test_url_format() {
        let mut rng = RandomGenerator::new(Some(42));
        let url_str = url(&mut rng);

        assert!(url_str.starts_with("https://"));
        assert!(url_str.contains("/"));
    }

    #[test]
    fn test_phone_format() {
        let mut rng = RandomGenerator::new(Some(42));
        let phone_num = phone(&mut rng);

        assert!(phone_num.starts_with("+7 "));
        assert_eq!(phone_num.len(), 16);
    }

    #[test]
    fn test_uuid_format() {
        let mut rng = RandomGenerator::new(Some(42));
        let uuid_str = uuid(&mut rng);

        assert_eq!(uuid_str.len(), 36);
        assert_eq!(uuid_str.chars().filter(|c| *c == '-').count(), 4);
        assert!(uuid_str.contains('4')); // Version 4
    }

    #[test]
    fn test_person_name() {
        let mut rng = RandomGenerator::new(Some(42));
        let name = person_name(&mut rng);

        assert!(name.contains(' '));
        let parts: Vec<&str> = name.split(' ').collect();
        assert_eq!(parts.len(), 2);
    }

    #[test]
    fn test_string_for_property_email() {
        let mut rng = RandomGenerator::new(Some(42));
        let result = string_for_property(&mut rng, "userEmail");
        assert!(result.contains("@"));
    }

    #[test]
    fn test_string_for_property_url() {
        let mut rng = RandomGenerator::new(Some(42));
        let result = string_for_property(&mut rng, "profileUrl");
        assert!(result.starts_with("https://"));
    }

    #[test]
    fn test_string_for_property_name() {
        let mut rng = RandomGenerator::new(Some(42));
        let result = string_for_property(&mut rng, "name");
        assert!(result.contains(' ')); // Should be "FirstName LastName"
    }

    #[test]
    fn test_string_for_property_city() {
        let mut rng = RandomGenerator::new(Some(42));
        let result = string_for_property(&mut rng, "city");
        assert!(CITIES.contains(&result.as_str()));
    }

    #[test]
    fn test_deterministic_semantic() {
        let mut rng1 = RandomGenerator::new(Some(42));
        let mut rng2 = RandomGenerator::new(Some(42));

        assert_eq!(email(&mut rng1), email(&mut rng2));
        assert_eq!(url(&mut rng1), url(&mut rng2));
        assert_eq!(phone(&mut rng1), phone(&mut rng2));
        assert_eq!(uuid(&mut rng1), uuid(&mut rng2));
    }
}
