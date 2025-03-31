const { execSync } = require("child_process")
const fs = require("fs")
const path = require("path")

const CERT_PATH = path.join(__dirname, "cert.pem")

// Check if cert.pem already exists
if (fs.existsSync(CERT_PATH)) {
    console.log("✅ Certificate already exists. No action needed.")
    process.exit(0)
}

console.log("🔧 Generating self-signed certificate...")

try {
    execSync(
        `openssl req -x509 -newkey rsa:2048 -keyout cert.pem -out cert.pem -days 365 -nodes -subj "/CN=localhost"`,
        { stdio: "inherit" }
    )
    console.log("✅ Certificate generated successfully!")
} catch (error) {
    console.error("❌ Failed to generate certificate. Ensure OpenSSL is installed.")
    process.exit(1)
}
