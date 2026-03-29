using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PharmacyManagementAPI.Data;
using PharmacyManagementAPI.Models;

namespace PharmacyManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class OnlineOrdersController : ControllerBase
    {
        private readonly ApiDbContext _context;

        public OnlineOrdersController(ApiDbContext context)
        {
            _context = context;
        }

        // --- 1. SAVE NEW ORDER 
        [HttpPost]
        public async Task<ActionResult<OnlineOrder>> PostOrder([FromBody] OnlineOrder order)
        {
            // If the data from React is missing or null, return an error immediately
            if (order == null)
            {
                return BadRequest("Order data is null.");
            }

            try
            {
                // Safety: Ensure these are set even if React forgot them
                order.OrderDate = DateTime.Now;
                if (string.IsNullOrEmpty(order.Status))
                {
                    order.Status = "Processing";
                }

                _context.OnlineOrders.Add(order);
                await _context.SaveChangesAsync();

                return Ok(order);
            }
            catch (Exception ex)
            {
                // print the exact SQL error in the Visual Studio output window
                Console.WriteLine($"Database Error: {ex.Message}");
                return BadRequest($"Error saving order: {ex.Message}");
            }
        }
        // --- 2. GET USER HISTORY ---
        [HttpGet("MyHistory/{userId}")]
        public async Task<ActionResult<IEnumerable<OnlineOrder>>> GetClientHistory(int userId)
        {
            var history = await _context.OnlineOrders
                .Where(o => o.UserId == userId)
                .OrderByDescending(o => o.OrderDate)
                .ToListAsync();

            return Ok(history);
        }
    }
}