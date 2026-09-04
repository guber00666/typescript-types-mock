// Random number generator and semantic string generators
// This module provides deterministic random generation using mulberry32 PRNG

pub mod semantic;

use rand::Rng;

/// Random generator using mulberry32 PRNG for deterministic output
pub struct RandomGenerator {
    state: u32,
    seeded: bool,
}

impl RandomGenerator {
    /// Create a new random generator with optional seed
    pub fn new(seed: Option<i64>) -> Self {
        let (state, seeded) = if let Some(s) = seed {
            (s as u32, true)
        } else {
            // Use random seed from system
            let mut rng = rand::thread_rng();
            (rng.gen::<u32>(), false)
        };

        Self { state, seeded }
    }

    /// Mulberry32 PRNG - generates next random number in [0, 1)
    fn mulberry32(&mut self) -> f64 {
        self.state = self.state.wrapping_add(0x6D2B79F5);
        let mut t = self.state;
        t = t.wrapping_mul(t | 0x5D8E2869);
        t = t ^ (t >> 15);
        t = t.wrapping_mul(t | 0x2C9276B5);
        t = t ^ (t >> 15);
        (t as f64) / (u32::MAX as f64 + 1.0)
    }

    /// Get next random float in [0, 1)
    pub fn next(&mut self) -> f64 {
        self.mulberry32()
    }

    /// Generate random string from pool
    pub fn string(&mut self) -> String {
        semantic::string_for_property(self, "random")
    }

    /// Generate random integer in [min, max)
    pub fn number(&mut self, min: Option<i64>, max: Option<i64>) -> i64 {
        let min = min.unwrap_or(0);
        let max = max.unwrap_or(100);
        let range = max - min;
        min + (self.next() * range as f64) as i64
    }

    /// Generate random float in [min, max)
    pub fn float(&mut self, min: Option<f64>, max: Option<f64>) -> f64 {
        let min = min.unwrap_or(0.0);
        let max = max.unwrap_or(100.0);
        let range = max - min;
        min + self.next() * range
    }

    /// Generate random boolean
    pub fn boolean(&mut self) -> bool {
        self.next() >= 0.5
    }

    /// Generate random date as ISO 8601 string
    pub fn date(&mut self) -> String {
        use chrono::{Duration, Utc};

        let now = Utc::now();
        let days_offset = self.number(Some(-365), Some(365));
        let random_date = now + Duration::days(days_offset);
        random_date.to_rfc3339()
    }

    /// Pick random item from slice
    pub fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        let index = (self.next() * items.len() as f64) as usize;
        &items[index.min(items.len() - 1)]
    }

    /// Check if generator is seeded (deterministic)
    pub fn is_seeded(&self) -> bool {
        self.seeded
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_deterministic_with_seed() {
        let mut rng1 = RandomGenerator::new(Some(42));
        let mut rng2 = RandomGenerator::new(Some(42));

        for _ in 0..10 {
            assert_eq!(rng1.next(), rng2.next());
        }
    }

    #[test]
    fn test_different_seeds() {
        let mut rng1 = RandomGenerator::new(Some(42));
        let mut rng2 = RandomGenerator::new(Some(100));

        let v1 = rng1.next();
        let v2 = rng2.next();
        assert_ne!(v1, v2);
    }

    #[test]
    fn test_number_range() {
        let mut rng = RandomGenerator::new(Some(42));

        for _ in 0..100 {
            let n = rng.number(Some(10), Some(20));
            assert!(n >= 10 && n < 20);
        }
    }

    #[test]
    fn test_float_range() {
        let mut rng = RandomGenerator::new(Some(42));

        for _ in 0..100 {
            let f = rng.float(Some(5.0), Some(10.0));
            assert!(f >= 5.0 && f < 10.0);
        }
    }

    #[test]
    fn test_boolean() {
        let mut rng = RandomGenerator::new(Some(42));

        let mut true_count = 0;
        let mut false_count = 0;

        for _ in 0..100 {
            if rng.boolean() {
                true_count += 1;
            } else {
                false_count += 1;
            }
        }

        // Should have roughly 50/50 distribution
        assert!(true_count > 30 && true_count < 70);
        assert!(false_count > 30 && false_count < 70);
    }

    #[test]
    fn test_pick() {
        let mut rng = RandomGenerator::new(Some(42));
        let items = vec!["a", "b", "c", "d", "e"];

        for _ in 0..10 {
            let picked = rng.pick(&items);
            assert!(items.contains(picked));
        }
    }

    #[test]
    fn test_date_format() {
        let mut rng = RandomGenerator::new(Some(42));
        let date = rng.date();

        // Should be valid ISO 8601 format
        assert!(date.contains("T"));
        assert!(date.len() > 20);
    }
}
