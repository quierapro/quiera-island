//! The PC's addresses on its local network, for links a phone opens.

use std::net::Ipv4Addr;

use windows::Win32::Foundation::ERROR_BUFFER_OVERFLOW;
use windows::Win32::NetworkManagement::IpHelper::{
    GAA_FLAG_INCLUDE_GATEWAYS, GAA_FLAG_SKIP_ANYCAST, GAA_FLAG_SKIP_DNS_SERVER,
    GAA_FLAG_SKIP_MULTICAST, GetAdaptersAddresses, IP_ADAPTER_ADDRESSES_LH,
};
use windows::Win32::NetworkManagement::Ndis::IfOperStatusUp;
use windows::Win32::Networking::WinSock::{AF_INET, SOCKADDR_IN};

const IF_TYPE_ETHERNET: u32 = 6;
const IF_TYPE_WIFI: u32 = 71;

/// Adapters that look like Ethernet but lead elsewhere than the room's
/// network: VPNs and virtual machines' switches.
const VIRTUAL: [&str; 9] = [
    "virtual",
    "hyper-v",
    "vmware",
    "virtualbox",
    "vpn",
    "tap-",
    "wireguard",
    "tailscale",
    "zerotier",
];

/// IPv4 addresses of the Wi-Fi and Ethernet adapters that are up and have a
/// gateway (a router), virtual and VPN adapters left out.
pub fn lan_addresses() -> Vec<Ipv4Addr> {
    let flags = GAA_FLAG_INCLUDE_GATEWAYS
        | GAA_FLAG_SKIP_ANYCAST
        | GAA_FLAG_SKIP_MULTICAST
        | GAA_FLAG_SKIP_DNS_SERVER;
    let mut size = 16 * 1024u32;
    // u64s: the adapter records need 8-byte alignment.
    let mut buffer: Vec<u64>;
    loop {
        buffer = vec![0; (size as usize).div_ceil(8)];
        // SAFETY: the buffer holds `size` bytes, as Windows is told.
        let result = unsafe {
            GetAdaptersAddresses(
                u32::from(AF_INET.0),
                flags,
                None,
                Some(buffer.as_mut_ptr().cast()),
                &mut size,
            )
        };
        if result == ERROR_BUFFER_OVERFLOW.0 {
            continue;
        }
        if result != 0 {
            return Vec::new();
        }
        break;
    }
    let mut out = Vec::new();
    let mut adapter = buffer.as_ptr().cast::<IP_ADAPTER_ADDRESSES_LH>();
    // SAFETY: a linked list Windows wrote into `buffer`, alive while it is.
    unsafe {
        while let Some(a) = adapter.as_ref() {
            adapter = a.Next;
            let physical = a.IfType == IF_TYPE_ETHERNET || a.IfType == IF_TYPE_WIFI;
            if !physical || a.OperStatus != IfOperStatusUp || a.FirstGatewayAddress.is_null() {
                continue;
            }
            let description = a.Description.to_string().unwrap_or_default().to_lowercase();
            if VIRTUAL.iter().any(|v| description.contains(v)) {
                continue;
            }
            let mut unicast = a.FirstUnicastAddress;
            while let Some(u) = unicast.as_ref() {
                unicast = u.Next;
                let address = u.Address.lpSockaddr;
                if !address.is_null() && (*address).sa_family == AF_INET {
                    let sin = &*address.cast::<SOCKADDR_IN>();
                    out.push(Ipv4Addr::from(u32::from_be(sin.sin_addr.S_un.S_addr)));
                }
            }
        }
    }
    out
}
