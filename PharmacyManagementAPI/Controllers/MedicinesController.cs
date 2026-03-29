using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Authorization; // 1. Added for Security
using PharmacyManagementAPI.Data;
using PharmacyManagementAPI.Models;

namespace PharmacyManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    // [Authorize] // Optional: Uncomment this to require login for EVERY action in this controller
    public class MedicinesController : ControllerBase
    {
        private readonly ApiDbContext _context;

        public MedicinesController(ApiDbContext context)
        {
            _context = context;
        }

        // 1. GET: api/Medicines (Fetch all)
        [HttpGet]
        // Everyone (even Staff) can view the inventory
        public async Task<ActionResult<IEnumerable<Medicine>>> GetMedicines()
        {
            return await _context.Medicines.ToListAsync();
        }

        // 2. POST: api/Medicines (Add New)
        [HttpPost]
        [AllowAnonymous]
        //[Authorize(Roles = "Admin,Pharmacist")] // 2. Only Admins or Pharmacists can add stock
        public async Task<ActionResult<Medicine>> PostMedicine(Medicine medicine)
        {
            // 1. Handle Optional Barcode: Convert empty strings to null
            // This allows SQL's Unique Filtered Index to ignore empty fields
            if (string.IsNullOrWhiteSpace(medicine.Barcode))
            {
                medicine.Barcode = null;
            }
            // 2. Check if Name already exists 
            var nameExists = await _context.Medicines
                .AnyAsync(m => m.Name.ToLower().Trim() == medicine.Name.ToLower().Trim());

            if (nameExists)
            {
                return Conflict(new { message = $"The medicine '{medicine.Name}' is already in the pharmacy." });
            }
            // 3. Check if Barcode already exists (ONLY if a barcode was actually entered)
            if (medicine.Barcode != null)
            {
                var barcodeExists = await _context.Medicines
                    .AnyAsync(m => m.Barcode == medicine.Barcode);

                if (barcodeExists)
                {
                    return Conflict(new { message = $"The barcode '{medicine.Barcode}' is already assigned to another medicine." });
                }
            }

            _context.Medicines.Add(medicine);
            await _context.SaveChangesAsync();

            return CreatedAtAction(nameof(GetMedicines), new { id = medicine.Id }, medicine);
        }

        // 3. GET: api/Medicines/CheckInteractionByMedicine
        [HttpGet("CheckInteractionByMedicine")]
        public async Task<IActionResult> CheckInteractionByMedicine(string med1, string med2)
        {
            // Find both medicines in the database based on the search names provided
            var medicineA = await _context.Medicines.FirstOrDefaultAsync(m =>
                m.Name.ToLower().Trim() == med1.ToLower().Trim());

            var medicineB = await _context.Medicines.FirstOrDefaultAsync(m =>
                m.Name.ToLower().Trim() == med2.ToLower().Trim());

            // Validation check ensures the system only processes valid inventory items
            if (medicineA == null || medicineB == null)
            {
                return BadRequest("One or both medicines not found in database.");
            }

            // --- AUTOMATED INTERACTION GUARD (Decision Support Logic) ---
            // We use standard boolean logic because EF Core cannot translate null-conditional operators into SQL
            // This compares brand names directly to match our updated SQL data
            var interaction = await _context.DrugInteractions.FirstOrDefaultAsync(di =>
                ((di.Ingredient1 == medicineA.Name && di.Ingredient2 == medicineB.Name) ||
                 (di.Ingredient1 == medicineB.Name && di.Ingredient2 == medicineA.Name)));

            if (interaction != null)
            {
                // Return 400 BadRequest to trigger the 'Clinical Danger' popup in the React frontend
                return BadRequest($"🛑 DANGER: {interaction.WarningMessage} (Severity: {interaction.Severity})");
            }

            return Ok("✅ No known interactions found. Safe to dispense.");
        }

        // 4. GET: api/Medicines/FindAlternatives/{name}
        [HttpGet("FindAlternatives/{name}")]
        public async Task<ActionResult<IEnumerable<Medicine>>> GetAlternatives(string name)
        {
            var target = await _context.Medicines
                .FirstOrDefaultAsync(m => m.Name.ToLower().Trim() == name.ToLower().Trim());

            if (target == null) return NotFound("Medicine not found.");

            return await _context.Medicines
                .Where(m => m.ActiveIngredient == target.ActiveIngredient
                       && m.Name.ToLower().Trim() != target.Name.ToLower().Trim()
                       && m.StockQuantity > 0
                       && m.IsActive != false) // ✅ Only suggest active medicines!
                .ToListAsync();
        }

        // 5. PUT: api/Medicines/{id} (Update)
        /*[HttpPut("{id}")]
        [AllowAnonymous]//[Authorize(Roles = "Admin,Pharmacist")] // 3. Only Admin or Pharmacist can update stock/prices
        public async Task<IActionResult> PutMedicine(int id, Medicine medicine)
        {
            /*if (id != medicine.Id) return BadRequest("ID Mismatch");

            // 1. Tell Entity Framework we are modifying this medicine
            _context.Entry(medicine).State = EntityState.Modified;

            // 2. FORCE Entity Framework to see the IsActive change
            _context.Entry(medicine).Property(x => x.IsActive).IsModified = true;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                // 3. This will print the REAL error in our black console window
                Console.WriteLine("REAL SQL ERROR: " + ex.InnerException?.Message ?? ex.Message);
                return StatusCode(500, ex.Message);
            }*/
        [HttpPut("{id}")]
        [AllowAnonymous]
        //[Authorize(Roles = "Admin,Pharmacist")]
        public async Task<IActionResult> PutMedicine(int id, [FromBody] Medicine medicine) // Added [FromBody]
        {
            // 1. Find the medicine in the database first
            var existingEntry = await _context.Medicines.FindAsync(id);
            if (existingEntry == null) return NotFound();

            // 2. Mapping ALL fields so they actually save to SQL
            existingEntry.Name = medicine.Name;
            existingEntry.ActiveIngredient = medicine.ActiveIngredient;
            existingEntry.Price = medicine.Price;         //  Saves the new discounted price
            existingEntry.BasePrice = medicine.BasePrice; //  Saves original price for the badge
            existingEntry.StockQuantity = medicine.StockQuantity;
            existingEntry.ExpiryDate = medicine.ExpiryDate;
            existingEntry.Category = medicine.Category;
            existingEntry.Barcode = medicine.Barcode;
            existingEntry.IsActive = medicine.IsActive;

            // 3. Save changes using the standard way (since the model is now correct)
            _context.Entry(existingEntry).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
                return NoContent();
            }
            catch (Exception ex)
            {
                // Check the black console for errors if this fails
                Console.WriteLine("SQL Save Error: " + ex.Message);
                return StatusCode(500, "Database update failed.");
            }
        }


        // 6. DELETE: api/Medicines/{id}
        [HttpDelete("{id}")]
        [AllowAnonymous]
        //[Authorize(Roles = "Admin")] // only YOU (the Admin) can do it
        public async Task<IActionResult> DeleteMedicine(int id)
        {
            var medicine = await _context.Medicines.FindAsync(id);
            if (medicine == null) return NotFound();

            // INSTEAD OF REMOVING: Just flip the switch
            medicine.IsActive = false;

            // Tell Entity Framework this is an update, not a delete
            _context.Entry(medicine).State = EntityState.Modified;

            await _context.SaveChangesAsync();

            return NoContent(); // Success!
        }
    }
}