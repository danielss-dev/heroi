use std::collections::HashSet;
use std::net::TcpListener;

const PORT_RANGE_SIZE: u16 = 10;
const PORT_START: u16 = 3000;
const PORT_MAX: u16 = 65000;

pub(crate) fn allocate_port_range(allocated: &HashSet<u16>) -> Result<u16, String> {
    let mut port = PORT_START;
    while port < PORT_MAX {
        if !allocated.contains(&port) && is_port_range_available(port) {
            return Ok(port);
        }
        port += PORT_RANGE_SIZE;
    }
    Err("No available port range found".into())
}

fn is_port_range_available(base: u16) -> bool {
    TcpListener::bind(("127.0.0.1", base)).is_ok()
}
