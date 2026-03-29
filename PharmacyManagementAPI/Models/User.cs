namespace PharmacyManagementAPI.Models
{
    public class User
    {
        public int Id { get; set; }
        public string Username { get; set; } = string.Empty;
        public string PasswordHash { get; set; } = string.Empty;// In a real app, we hash this! so we can use a library like BCrypt to hash the password before storing it in the database, and then we can verify the password during login by comparing the hashed password with the stored hash, but for now I will just store it as plain text for simplicity, but please don't do this in production!
        public string Role { get; set; } = "Staff"; // Admin, Pharmacist, or Staff, as staff is the default role, and then we can assign the appropriate role to each user during registration or through an admin panel, but for now I will just set it to "Staff" by default for simplicity, but in a real application, we would want to have a more robust role management system that allows for more granular permissions and access control, but for now I will just keep it simple with three roles: Admin, Pharmacist, and Staff.
        public string? FullName { get; set; }
        public string? PhoneNumber { get; set; }
    }
}