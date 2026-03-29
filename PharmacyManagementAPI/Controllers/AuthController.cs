using Microsoft.AspNetCore.Mvc;
using PharmacyManagementAPI.Data;
using PharmacyManagementAPI.Models;

namespace PharmacyManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class AuthController : ControllerBase 
    {
        private readonly ApiDbContext _context;

        public AuthController(ApiDbContext context)
        {
            _context = context;
        }

        [HttpPost("login")]
        public IActionResult Login([FromBody] User loginData)
        {
            // 1. Search for a user with matching name and password
            var user = _context.Users.FirstOrDefault(u =>
                u.Username == loginData.Username &&
                u.PasswordHash == loginData.PasswordHash &&
                u.Role == loginData.Role); // Verify the selected role matches SQL

            // 2. If not found, tell React "No entry!"
            if (user == null)
            {
                return Unauthorized(new { message = "Invalid Username or Password" });
            }

            // 3. If found, send back the user details 
            return Ok(new
            {
                username = user.Username,
                role = user.Role,
                token = "success-token-" + Guid.NewGuid().ToString() //  for demo
            });
        }

        [HttpPost("register")]
        public IActionResult Register([FromBody] User newUser)
        {
            // Check Username (Case-insensitive )
            if (_context.Users.Any(u => u.Username.ToLower() == newUser.Username.ToLower()))
            {
                return BadRequest(new { message = "Username is already taken." });
            }

            // Only check PhoneNumber if the user actually typed one
            // and ignore existing NULLs in the database
            if (!string.IsNullOrEmpty(newUser.PhoneNumber))
            {
                if (_context.Users.Any(u => u.PhoneNumber == newUser.PhoneNumber && u.PhoneNumber != null))
                {
                    return BadRequest(new { message = "Phone number is already registered." });
                }
            }

            newUser.Role = "Client";

            try
            {
                _context.Users.Add(newUser);
                _context.SaveChanges();
                return Ok(new { message = "Registration successful!" });
            }
            catch (Exception ex)
            {
                // See the REAL error in the Visual Studio Output window
                return StatusCode(500, new { message = ex.InnerException?.Message ?? ex.Message });
            }
        }
    }
}