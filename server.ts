import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import axios from "axios";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cookieParser());

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;

// Auth Routes
app.get("/api/auth/github/url", (req, res) => {
  const redirectUri = `${req.protocol}://${req.get("host")}/api/auth/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,user`;
  res.json({ url });
});

app.get("/api/auth/github/callback", async (req, res) => {
  const { code } = req.query;

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: GITHUB_CLIENT_ID,
        client_secret: GITHUB_CLIENT_SECRET,
        code,
      },
      {
        headers: {
          Accept: "application/json",
        },
      }
    );

    const accessToken = tokenResponse.data.access_token;
    if (!accessToken) {
      throw new Error("Failed to get access token");
    }

    res.cookie("github_token", accessToken, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
    });

    res.send(`
      <html>
        <body>
          <script>
            window.opener.postMessage({ type: 'GITHUB_AUTH_SUCCESS' }, '*');
            window.close();
          </script>
          <p>Authentication successful. Closing window...</p>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("GitHub Auth Error:", error);
    res.status(500).send("Authentication failed");
  }
});

app.get("/api/auth/github/status", (req, res) => {
  const token = req.cookies.github_token;
  res.json({ isAuthenticated: !!token });
});

app.post("/api/auth/github/logout", (req, res) => {
  res.clearCookie("github_token");
  res.json({ success: true });
});

// GitHub Data Routes
app.get("/api/github/repos", async (req, res) => {
  const token = req.cookies.github_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await axios.get("https://api.github.com/user/repos?sort=updated", {
      headers: {
        Authorization: `token ${token}`,
      },
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch repositories" });
  }
});

app.get("/api/github/repos/:owner/:repo/contents", async (req, res) => {
  const { owner, repo } = req.params;
  const pathParam = req.query.path || "";
  const token = req.cookies.github_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${pathParam}`,
      {
        headers: {
          Authorization: `token ${token}`,
        },
      }
    );
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch contents" });
  }
});

app.get("/api/github/repos/:owner/:repo/file", async (req, res) => {
  const { owner, repo } = req.params;
  const filePath = req.query.path as string;
  const token = req.cookies.github_token;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const response = await axios.get(
      `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`,
      {
        headers: {
          Authorization: `token ${token}`,
          Accept: "application/vnd.github.v3.raw",
        },
      }
    );
    res.send(response.data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch file content" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
