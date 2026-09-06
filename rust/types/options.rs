// Mock generation options
// This module defines the options that can be passed to mock generation functions

#[cfg(feature = "node")]
use napi_derive::napi;
use serde_json::Value;

/// Options for mock generation
#[cfg_attr(feature = "node", napi(object))]
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MockOptions {
    /// Random seed for deterministic output
    pub seed: Option<i64>,

    /// Override specific values in the generated mock
    pub overrides: Option<Value>,

    /// Maximum depth for nested objects (default: 5)
    pub max_depth: Option<u32>,

    /// Length of generated arrays (default: 2)
    pub array_length: Option<u32>,

    /// Whether to include optional properties (default: true)
    pub include_optional: Option<bool>,
}

impl Default for MockOptions {
    fn default() -> Self {
        Self {
            seed: None,
            overrides: None,
            max_depth: Some(5),
            array_length: Some(2),
            include_optional: Some(true),
        }
    }
}

impl MockOptions {
    /// Get the effective max depth
    pub fn effective_max_depth(&self) -> u32 {
        self.max_depth.unwrap_or(5)
    }

    /// Get the effective array length
    pub fn effective_array_length(&self) -> u32 {
        self.array_length.unwrap_or(2)
    }

    /// Get the effective include_optional flag
    pub fn effective_include_optional(&self) -> bool {
        self.include_optional.unwrap_or(true)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_options() {
        let opts = MockOptions::default();
        assert_eq!(opts.seed, None);
        assert_eq!(opts.overrides, None);
        assert_eq!(opts.effective_max_depth(), 5);
        assert_eq!(opts.effective_array_length(), 2);
        assert_eq!(opts.effective_include_optional(), true);
    }

    #[test]
    fn test_custom_options() {
        let opts = MockOptions {
            seed: Some(42),
            overrides: None,
            max_depth: Some(10),
            array_length: Some(5),
            include_optional: Some(false),
        };

        assert_eq!(opts.seed, Some(42));
        assert_eq!(opts.effective_max_depth(), 10);
        assert_eq!(opts.effective_array_length(), 5);
        assert_eq!(opts.effective_include_optional(), false);
    }
}
