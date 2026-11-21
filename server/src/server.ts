import "dotenv/config";
import app from "./app";

if (!process.env.JWT_SECRET) {
  console.error("JWT_SECRET is not set. Copy .env.example to .env first.");
  process.exit(1);
}

const port = Number(process.env.PORT ?? 4000);
app.listen(port, () => {
  console.log(`Plant Point Mart running on http://localhost:${port}`);
});
