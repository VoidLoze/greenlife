package kz.greenleaf.store.common;

import jakarta.servlet.http.HttpServletRequest;

public record ClientInfo(String ip, String userAgent) {

    private static final int MAX_USER_AGENT = 255;

    public static ClientInfo from(HttpServletRequest request) {
        String ip = request.getRemoteAddr();
        String userAgent = request.getHeader("User-Agent");
        if (userAgent != null && userAgent.length() > MAX_USER_AGENT) {
            userAgent = userAgent.substring(0, MAX_USER_AGENT);
        }
        return new ClientInfo(ip == null ? "unknown" : ip, userAgent);
    }
}
