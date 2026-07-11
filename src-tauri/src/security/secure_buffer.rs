use zeroize::Zeroize;
use std::sync::atomic::Ordering;

/// 持有敏感像素数据（PNG 字节）的容器，离开作用域时自动清零，
/// 避免截图数据残留在内存中。
#[derive(Clone)]
pub struct SecureBuffer {
    data: Vec<u8>,
}

impl SecureBuffer {
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    pub fn data(&self) -> &[u8] {
        &self.data
    }

    pub fn secure_zeroize(&mut self) {
        self.data.zeroize();
        std::sync::atomic::compiler_fence(Ordering::SeqCst);
    }
}

impl Drop for SecureBuffer {
    fn drop(&mut self) {
        self.secure_zeroize();
    }
}
