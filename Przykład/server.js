const express = require("express");
const jwt = require("jsonwebtoken");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = 3000;
const SECRET_KEY = "super_tajny_klucz_jwt";


const users = [];

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

const getView = (filename) =>
  fs.readFileSync(path.join(__dirname, "views", filename), "utf-8");

// --- POMOCNICZE FUNKCJE DO KOMUNIKATÓW (Tailwind CSS) ---
const getErrorMsg = (msg) => `
    <div class="bg-red-100 border-l-4 border-red-500 text-red-700 p-3 mb-4 text-sm rounded" role="alert">
        <p class="font-bold">Błąd</p>
        <p>${msg}</p>
    </div>`;

const getSuccessMsg = (msg) => `
    <div class="bg-green-100 border-l-4 border-green-500 text-green-700 p-3 mb-4 text-sm rounded" role="alert">
        <p class="font-bold">Sukces</p>
        <p>${msg}</p>
    </div>`;

// --- ROUTING WIDOKÓW (GET) ---
app.get("/login", (req, res) => res.send(getView("login.html")));
app.get("/register", (req, res) => res.send(getView("register.html")));

// --- NOWY ENDPOINT DLA SPRAWDZENIA STANU SESJI PRZY ODŚWIEŻENIU ---
app.get("/api/login-status", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    // Brak tokena -> zwracamy widok logowania
    return res.send(getView("login.html"));
  }

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      // Token nieprawidłowy/wygasły -> zwracamy logowanie
      return res.send(getView("login.html"));
    }

    const userExists = users.find((u) => u.username === decoded.user);

    if (userExists) {
      // Token jest OK i użytkownik istnieje -> zwracamy dashboard
      let dashboard = getView("dashboard.html");
      dashboard = dashboard.replace("Użytkowniku", decoded.user);
      return res.send(dashboard);
    } else {
      // Użytkownik nie istnieje w bazie -> zwracamy logowanie
      return res.send(getView("login.html"));
    }
  });
});
// -----------------------------------------------------------------

// --- API (POST) ---

// 1. REJESTRACJA
app.post("/api/register", (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.send(
      getErrorMsg("Wypełnij wszystkie pola!") + getView("register.html")
    );
  }
  const existingUser = users.find((u) => u.username === username);
  if (existingUser) {
    return res.send(
      getErrorMsg(`Użytkownik ${username} już istnieje!`) +
        getView("register.html")
    );
  }

  users.push({ username, password });
  console.log("Aktualna baza użytkowników:", users);

  // Zwracamy komunikat sukcesu + widok logowania
  res.send(
    getSuccessMsg("Konto utworzone! Zaloguj się.") + getView("login.html")
  );
});

// 2. LOGOWANIE
app.post("/api/login", (req, res) => {
  const { username, password } = req.body;
  const user = users.find(
    (u) => u.username === username && u.password === password
  );

  if (user) {
    const token = jwt.sign({ user: user.username }, SECRET_KEY, {
      expiresIn: "1h",
    });

    // 1. Ustawiamy Token w Nagłówku
    res.set("X-Auth-Token", token);

    // 2. Zwracamy gotowy widok Dashboardu w ciele odpowiedzi
    let dashboard = getView("dashboard.html");
    dashboard = dashboard.replace("Użytkowniku", user.username);

    // HTMX automatycznie podmieni #main-content na ten HTML
    res.send(dashboard);
  } else {
    res.send(getErrorMsg("Błędny login lub hasło!") + getView("login.html"));
  }
});

// 3. TAJNE DANE
app.get("/api/secret", (req, res) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];
  if (!token)
    return res.send(
      '<span class="text-red-500 font-bold">Brak dostępu (brak tokena)!</span>'
    );

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err)
      return res.send(
        '<span class="text-red-500 font-bold">Token nieważny lub wygasł!</span>'
      );
    const userExists = users.find((u) => u.username === decoded.user);

    if (userExists) {
      // Zwracamy ładnie sformatowany HTML
      res.send(`
            <div class="text-center animate-fade-in-down">
                <p class="text-lg text-gray-800 font-semibold">Tajne dane dla: <span class="text-blue-600">${
                  decoded.user
                }</span></p>
                <p class="text-sm text-gray-500 mt-2">Liczba użytkowników w systemie: <span class="font-bold">${
                  users.length
                }</span></p>
                <p class="text-xs text-gray-400 mt-1">Data zapytania: ${new Date().toLocaleTimeString()}</p>
            </div>
        `);
    } else {
      res.send(
        '<span class="text-red-500">Użytkownik nie istnieje w bazie!</span>'
      );
    }
  });
});

// 4. WYLOGOWANIE
app.post("/api/logout", (req, res) => {
  res.set("X-Logout", "true");
  // Zwracamy widok logowania z komunikatem sukcesu
  res.send(getSuccessMsg("Wylogowano pomyślnie.") + getView("login.html"));
});

app.listen(PORT, () => {
  console.log(`Serwer działa na http://localhost:${PORT}`);
});
