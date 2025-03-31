# aName

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE) <!-- Replace with actual license link -->

**Tired of username headaches? `aName` provides deterministic usernames, so you don't have to.**

`aName` is a backend service designed to generate unique and deterministic usernames from any input string. It solves the common problem of needing usernames when integrating with authentication providers like Keycloak (especially when you *don't* want to use email addresses as usernames!). `aName` avoids unnecessary database lookups and complex collision handling, letting you focus on building your application.

**Read more about the motivation behind `aName`:** [Kind Pink Meal Blog Post](https://blog.june07.com/kind-pink-meal)

**The Problem:**

When building software, you often need to generate a username for new users. Using email addresses as usernames can be undesirable. Generating random usernames and checking for collisions in the database is inefficient and adds complexity.

**The Solution:**

`aName` provides a simple API endpoint that takes any string as input (e.g., the user's `sub` from Keycloak) and returns a deterministic username. This means that the same input will always produce the same username. `aName` uses a combination of dictionaries and hashing to generate usernames with a high probability of uniqueness, minimizing the need for collision handling.

## 🚀 Key Benefits

*   **Deterministic:** The same input always generates the same username.
*   **Efficient:** Avoids unnecessary database lookups for collision checking.
*   **Simple:** Easy to integrate with any application.
*   **Customizable:** Choose from different dictionaries and algorithms.
*   **Reduces Drudgery:** Focus on building your application, not managing usernames.

## 📝 Table of Contents

*   [Features](#✨-features)
*   [Tech Stack](#🛠️-tech-stack)
*   [Getting Started](#getting-started)
    *   [Installation](#⚙️-installation)
    *   [Configuration](#configuration)
*   [Usage](#usage)
*   [API Reference](#api-reference)
*   [Roadmap](#roadmap)
*   [Self-Hosting with Docker](#self-hosting-with-docker)
*   [Contributing](#🤝-contributing)
*   [License](#license)
*   [Contact](#contact)

## ✨ Features

*   **Deterministic Username Generation:** Generates unique usernames based on a given input string.
*   **REST API:** Simple and easy-to-use API endpoint.
*   **Configurable Dictionaries:** Choose from different dictionaries to customize the generated usernames.
*   **Collision Resistance:** Designed to minimize the probability of username collisions.
*   **HA Proxy Routing:** Routes lookup requests to appropriate GitHub repos (CDN) for dictionaries.
*   **Lookup UI:** Demonstrates retrieving generated names from the backend and GitHub.

## 🛠️ Tech Stack

*   [Node.js](https://nodejs.org/): JavaScript runtime environment.
*   [Express](https://expressjs.com/): Web application framework.
*   [Redis](https://redis.io/): In-memory data store for caching.
*   [MongoDB](https://www.mongodb.com/): NoSQL database.
*   [Docker](https://www.docker.com/): Containerization platform.

## Getting Started

### ⚙️ Installation
![docker-run](https://github.com/user-attachments/assets/210fd8f0-dff5-4754-84c8-75054e8c3a72)

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/june07/aname.git
    cd aname
    ```

2.  **Install dependencies:**

    ```bash
    npm install
    ```

3.  **Run:**

    ```bash
    npm run docker:dev
    ```

### Configuration

1.  **Environment Variables:**

    The application relies on environment variables for configuration. Create a `.env.local` file in the root directory based on the `.env.example`. The following essential variables, specific to aName are defined:

    *   `GITHUB_USER`: The owner of the GitHub account to which the name data is written.
    *   `GITHUB_ORG`: The organization of the GitHub account to which the name data is written.
    *   `GITHUB_PAT`: The personal access token of the owner of the GitHub account to which the name data is written.
    *   `ANAME_PRIVATE_KEY`: The aName generated private key in the case you want to dogfood or use another aName service to manage this instances names
    *   `ANAME_PUBLIC_KEY`: Ditto to the above but for the public key
    *   `ANAME_API_KEY`: Ditto to the above but for the API key
    *   `ANAME_API_URL`: Ditto to the above but for the API URL
    *   (Other environment variables as needed - refer to the codebase)

## Usage

**Example: Generating a username from a Keycloak `sub`**

```javascript
// Assuming you have the aName API running at http://localhost:3000

const axios = require('axios');

async function generateUsername(keycloakSub) {
  try {
    const response = await axios.get(`http://localhost:3000/api/generate?input=${keycloakSub}`);
    const username = response.data.username;
    console.log('Generated username:', username);
    return username;
  } catch (error) {
    console.error('Error generating username:', error.response.data);
    return null;
  }
}

// Example usage with a Keycloak sub
generateUsername('your-keycloak-user-sub');
```

## API Reference

(Link to automatically generated API documentation - e.g., using Swagger or similar tool)

## Roadmap

*   [ ] Improve documentation and add more examples.
*   [ ] Implement more comprehensive API testing.
*   [ ] Add metrics and monitoring endpoints.

## Self-Hosting with Docker

`aName` can be easily self-hosted using the provided Docker configs. Simply a matter of tweaking things to suit your own needs.


## 🤝 Contributing

We welcome contributions from the community! Please follow these guidelines:

1.  Fork the repository.
2.  Create a new branch for your feature or bug fix.
3.  Make your changes and commit them with clear, concise messages.
4.  Submit a pull request.

Be calmed to know there shall be no ass hole gatekeeping, ultra picky, self assuming behavior by the maintainer!

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

[june07](https://github.com/june07) - 667@june07.com
