import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;

public class WorkspaceClient {

    // Target API endpoint updated to your live Google Apps Script web application
    private static final String WEB_APP_URL = "https://script.google.com/macros/s/AKfycbx9E312KyC2ncLZfGSU2SasbB8iUR8VWhsH1DtNa_8auqxx5POkpdKqzBh22AjgX6r1CQ/exec";
    
    private final HttpClient httpClient;

    public WorkspaceClient() {
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build();
    }

    /**
     * Dispatches a synchronization payload directly to the Apps Script endpoint engine.
     * @param jsonPayload Strictly structured raw JSON string containing actions and parameter maps.
     * @return String literal JSON response structure from Google Sheets.
     */
    public String executeSpreadsheetAction(String jsonPayload) {
        try {
            HttpRequest request = HttpRequest.newBuilder()
                    .uri(URI.create(WEB_APP_URL))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                    .build();

            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            return response.body();
        } catch (Exception e) {
            return "{\"status\":\"error\",\"message\":\"Network communication failed: " + e.getMessage() + "\"}";
        }
    }

    /**
     * Compiles an authorized action block to safely append a user profile matrix inside the database.
     */
    public String syncNewUser(String username, String password, String role, String triggeredByAdmin) {
        String json = String.format(
            "{\"action\":\"addUser\",\"username\":\"%s\",\"password\":\"%s\",\"role\":\"%s\",\"triggeredBy\":\"%s\"}",
            username, password, role, triggeredByAdmin
        );
        return executeSpreadsheetAction(json);
    }

    /**
     * Compiles an administrative deletion index block to drop an unwanted failed security log entry.
     */
    public String purgeFailedLogEntry(int targetRowIndex, String triggeredByAdmin) {
        String json = String.format(
            "{\"action\":\"deleteLog\",\"rowIndex\":\"%d\",\"triggeredBy\":\"%s\"}",
            targetRowIndex, triggeredByAdmin
        );
        return executeSpreadsheetAction(json);
    }

    // Diagnostic execution entry loop point
    public static void main(String[] args) {
        WorkspaceClient client = new WorkspaceClient();
        
        System.out.println("--- Booting Workspace API Connection Client ---");
        // Test query to pull file structures
        String fileQueryPayload = "{\"action\":\"getFiles\"}";
        String response = client.executeSpreadsheetAction(fileQueryPayload);
        System.out.println("Server Connectivity Check Response:\n" + response);
    }
}
