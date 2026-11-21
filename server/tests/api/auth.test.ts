import { beforeEach, describe, expect, it } from "vitest";
import { app, createUser, prisma, request, resetDb, signedIn } from "../helpers";

beforeEach(resetDb);

describe("register", () => {
  it("creates a customer, signs them in and never returns the password", async () => {
    const agent = request.agent(app);
    const res = await agent.post("/api/auth/register").send({ name: "Priya", email: "Priya@Example.com", password: "secret123" });
    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ name: "Priya", email: "priya@example.com", role: "CUSTOMER", mustChangePassword: false });
    expect(res.body.user.password).toBeUndefined();
    expect(res.body.user.sessionVersion).toBeUndefined();
    expect(res.headers["set-cookie"]?.[0]).toMatch(/ppm_token=.*HttpOnly/i);

    const me = await agent.get("/api/auth/me");
    expect(me.body.user.email).toBe("priya@example.com");
  });

  it("can't be used to make an admin", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "Sneaky", email: "s@example.com", password: "secret123", role: "ADMIN" });
    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("CUSTOMER");
  });

  it("rejects an email that's already registered (any letter case)", async () => {
    await createUser({ email: "taken@example.com" });
    const res = await request(app).post("/api/auth/register").send({ name: "Again", email: "TAKEN@example.com", password: "secret123" });
    expect(res.status).toBe(409);
  });

  it("reports each invalid field", async () => {
    const res = await request(app).post("/api/auth/register").send({ name: "A", email: "nope", password: "123" });
    expect(res.status).toBe(400);
    expect(Object.keys(res.body.details.fields).sort()).toEqual(["email", "name", "password"]);
  });
});

describe("login and logout", () => {
  it("signs in with the right password", async () => {
    const u = await createUser({ email: "login@example.com", password: "right-one" });
    const res = await request(app).post("/api/auth/login").send({ email: "LOGIN@example.com", password: "right-one" });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(u.id);
  });

  it("gives the same message for a wrong password and an unknown email", async () => {
    await createUser({ email: "login@example.com", password: "right-one" });
    const wrong = await request(app).post("/api/auth/login").send({ email: "login@example.com", password: "wrong" });
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@example.com", password: "wrong" });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.message).toBe(unknown.body.message);
  });

  it("guests get user: null from /me", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.body).toEqual({ user: null });
  });

  it("logout ends the session", async () => {
    const agent = await signedIn(await createUser());
    await agent.post("/api/auth/logout").expect(200);
    expect((await agent.get("/api/auth/me")).body.user).toBeNull();
  });

  it("ignores a forged or broken cookie", async () => {
    const res = await request(app).get("/api/cart").set("Cookie", "ppm_token=not-a-real-token");
    expect(res.status).toBe(401);
  });
});

describe("profile", () => {
  it("updates name and phone but not the email", async () => {
    const agent = await signedIn(await createUser({ email: "me@example.com" }));
    const res = await agent.patch("/api/auth/me").send({ name: "New Name", phone: "+91 90000 00001", email: "hacked@example.com" });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ name: "New Name", phone: "+91 90000 00001", email: "me@example.com" });
  });

  it("allows clearing the phone", async () => {
    const agent = await signedIn(await createUser());
    const res = await agent.patch("/api/auth/me").send({ name: "Name", phone: "" });
    expect(res.body.user.phone).toBeNull();
  });
});

describe("change password (needs the current password)", () => {
  it("rejects a wrong current password", async () => {
    const agent = await signedIn(await createUser({ password: "old-pass" }));
    const res = await agent.post("/api/auth/me/password").send({ currentPassword: "nope", newPassword: "new-pass" });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/current password is incorrect/i);
  });

  it("rejects reusing the same password", async () => {
    const agent = await signedIn(await createUser({ password: "same-pass" }));
    const res = await agent.post("/api/auth/me/password").send({ currentPassword: "same-pass", newPassword: "same-pass" });
    expect(res.status).toBe(400);
  });

  it("rejects a new password under 6 characters", async () => {
    const agent = await signedIn(await createUser({ password: "old-pass" }));
    const res = await agent.post("/api/auth/me/password").send({ currentPassword: "old-pass", newPassword: "12345" });
    expect(res.status).toBe(400);
    expect(res.body.details.fields.newPassword).toBeDefined();
  });

  it("changes it, keeps this device signed in and signs out other devices", async () => {
    const user = await createUser({ email: "two@example.com", password: "old-pass" });
    const phone = await signedIn(user);
    const laptop = await signedIn(user);

    const res = await phone.post("/api/auth/me/password").send({ currentPassword: "old-pass", newPassword: "new-pass" });
    expect(res.status).toBe(200);

    expect((await phone.get("/api/cart")).status).toBe(200);
    expect((await laptop.get("/api/cart")).status).toBe(401);

    expect((await request(app).post("/api/auth/login").send({ email: "two@example.com", password: "old-pass" })).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: "two@example.com", password: "new-pass" })).status).toBe(200);
  });
});

describe("forgot password: admin reset → customer sets a new one", () => {
  it("works end to end", async () => {
    const admin = await signedIn(await createUser({ role: "ADMIN" }));
    const customer = await createUser({ email: "forgot@example.com", password: "lost-it" });
    const oldSession = await signedIn(customer);

    const reset = await admin.post(`/api/admin/customers/${customer.id}/reset-password`);
    expect(reset.status).toBe(200);
    const temp: string = reset.body.temporaryPassword;
    expect(temp).toMatch(/^[a-z]{4}[2-9]{4}$/);

    // Old password and old session stop working straight away.
    expect((await oldSession.get("/api/cart")).status).toBe(401);
    expect((await request(app).post("/api/auth/login").send({ email: "forgot@example.com", password: "lost-it" })).status).toBe(401);

    // Signs in with the temporary password and is asked to change it.
    const agent = request.agent(app);
    const login = await agent.post("/api/auth/login").send({ email: "forgot@example.com", password: temp });
    expect(login.status).toBe(200);
    expect(login.body.user.mustChangePassword).toBe(true);

    const changed = await agent.post("/api/auth/me/password").send({ currentPassword: temp, newPassword: "mine-now" });
    expect(changed.status).toBe(200);
    expect(changed.body.user.mustChangePassword).toBe(false);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: customer.id } })).mustChangePassword).toBe(false);
  });
});
