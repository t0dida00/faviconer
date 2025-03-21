const express = require("express");
const axios = require("axios");
const cheerio = require("cheerio");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const app = express();

app.use(express.json()); // Enable JSON parsing
app.use(cors()); // Enable CORS for all routes
const upload = multer({ dest: "/tmp" });


app.get("/", (req, res) => {
    res.send("Hello world");
});

app.post("/favicons", async (req, res) => {
    const { urls } = req.body; // Extract an array of URLs

    if (!Array.isArray(urls) || urls.length === 0) {
        return res.status(400).json({ error: "Missing or invalid 'urls' parameter" });
    }

    try {
        const faviconPromises = urls.map(async (url) => {
            if (!/^https?:\/\//i.test(url)) {
                return { url, error: "Invalid URL format" };
            }

            try {
                const response = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(response.data);

                let favicon = $("link[rel='icon']").attr("href") ||
                    $("link[rel='shortcut icon']").attr("href");
                const name = $('title').text() || url.split("/")[2].split(".")[1] || "localhost";
                // const name = url.split("/")[2].split(".")[1] || "localhost";

                if (favicon) {

                    if (!favicon.startsWith("http")) {
                        const baseUrl = new URL(url).origin;
                        favicon = new URL(favicon, baseUrl).href;
                    }
                } else {
                    favicon = `${new URL(url).origin}/favicon.ico`;
                }

                return { name, url, favicon };
            } catch (error) {
                const name = url.split("/")[2].split(".")[1];
                return { name, url, error: "Unable to retrieve favicon" };
            }
        });

        const favicons = await Promise.all(faviconPromises);
        res.json({ favicons });
    } catch (error) {
        res.status(500).json({ error: "Server error" });
    }
});


app.post("/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
    }
    try {
        // Read the uploaded file
        const filePath = req.file.path;
        const fileContent = fs.readFileSync(filePath, "utf8");

        // Extract URLs from file (assuming one URL per line)
        const urls = fileContent.split("\n").map(line => line.trim()).filter(line => line);

        if (urls.length === 0) {
            return res.status(400).json({ error: "No valid URLs found in the file" });
        }

        // Fetch favicons for all URLs
        const faviconPromises = urls.map(async (url) => {
            if (!/^https?:\/\//i.test(url)) {
                return { url, error: "Invalid URL format" };
            }

            try {
                const response = await axios.get(url, { timeout: 5000 });
                const $ = cheerio.load(response.data);
                const name = url.split("/")[2].split(".")[1];
                let favicon = $("link[rel='icon']").attr("href") ||
                    $("link[rel='shortcut icon']").attr("href");

                if (favicon) {
                    if (!favicon.startsWith("http")) {
                        const baseUrl = new URL(url).origin;
                        favicon = new URL(favicon, baseUrl).href;
                    }
                } else {
                    favicon = `${new URL(url).origin}/favicon.ico`;
                }

                return { name, url, favicon };
            } catch (error) {
                const name = url.split("/")[2].split(".")[1];
                return { name, url, error: "Unable to retrieve favicon" };
            }
        });

        const favicons = await Promise.all(faviconPromises);

        // Delete the uploaded file after processing
        fs.unlinkSync(filePath);

        res.json({ favicons });
    } catch (error) {
        console.log(error)
        res.status(500).json({ error: "Server error" });
    }
});

app.post("/download-csv", async (req, res) => {
    try {
        // Create CSV header
        const csvRows = [];
        csvRows.push(['Order', 'Name', 'URL', 'Favicon URL']);

        // Get data from request body
        const { favicons } = req.body;

        if (!Array.isArray(favicons) || favicons.length === 0) {
            return res.status(400).json({ error: "Missing or invalid 'favicons' parameter" });
        }

        // Add data rows with order number
        let order = 1;
        favicons.forEach(item => {
            if (!item.error) {
                csvRows.push([order++, item.name,
                item.url,
                item.favicon,
                ]);
            }
        });

        // Convert to CSV string
        const csvContent = csvRows.map(row => row.join(',')).join('\n');

        // Set headers for file download
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=favicons.csv');

        // Send the CSV
        res.status(200).send(csvContent);

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
});

app.listen(3000, () => console.log("Server running on port 3000"));
