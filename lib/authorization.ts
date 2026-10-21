// Call only with the email returned by the server-verified identity provider.
export function registrationRole(verifiedEmail: string, adminEmail?: string) {
  const owner = adminEmail?.trim().toLowerCase();
  return owner && verifiedEmail.trim().toLowerCase() === owner ? "admin" : "member";
}
export function effectiveRole(person: {role: string; email: string}, verifiedEmail: string, adminEmail?: string) {
  return person.role === "admin" && registrationRole(verifiedEmail, adminEmail) === "admin"
    && person.email.trim().toLowerCase() === verifiedEmail.trim().toLowerCase() ? "admin" : "member";
}
