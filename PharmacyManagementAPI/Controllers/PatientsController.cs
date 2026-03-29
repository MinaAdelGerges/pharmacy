using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PharmacyManagementAPI.Data;
using PharmacyManagementAPI.Models;

[Route("api/[controller]")]
[ApiController]
public class PatientsController : ControllerBase
{
    private readonly ApiDbContext _context;
    public PatientsController(ApiDbContext context) { _context = context; }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Patient>>> GetPatients() => await _context.Patients.ToListAsync();

    [HttpPost]
    public async Task<ActionResult<Patient>> PostPatient(Patient patient)
    {
        _context.Patients.Add(patient);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetPatients), new { id = patient.Id }, patient);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> PutPatient(int id, Patient patient)
    {
        if (id != patient.Id) return BadRequest();

        _context.Entry(patient).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Patients.Any(e => e.Id == id)) return NotFound();
            else throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> DeletePatient(int id)
    {
        var patient = await _context.Patients.FindAsync(id);
        if (patient == null)
        {
            return NotFound();
        }
        // Step 1: Tell SQL to ignore the relationship and delete any hidden history// But I think this will not work because of the foreign key constraint, so we have to delete the history first
        var history = _context.PurchaseHistory.Where(h => h.PatientId == id);
        _context.PurchaseHistory.RemoveRange(history);
        _context.Patients.Remove(patient);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpGet("{id}/history")]
    public async Task<ActionResult<IEnumerable<PurchaseHistory>>> GetHistory(int id)
    {
        return await _context.PurchaseHistory.Where(ph => ph.PatientId == id).ToListAsync();
    }

    [HttpPost("RecordPurchase")]
    public async Task<IActionResult> RecordPurchase([FromBody] PurchaseRequest request)
    {
        // 1. Search for the patient by Phone Number
        var patient = await _context.Patients
            .FirstOrDefaultAsync(p => p.PhoneNumber == request.PatientPhone);

        if (patient == null)
        {
            return BadRequest("Patient phone not found in database.");
        }

        // 2. Create the history record
        var history = new PurchaseHistory
        {
            PatientId = patient.Id,
            MedicineName = request.MedicineName,
            Quantity = request.Quantity,
            TotalPrice = request.TotalPrice,
            PurchaseDate = DateTime.Now
        };

        _context.PurchaseHistory.Add(history);

        // 3. FORCE SQL TO UPDATE THE TOTALSPENT 
        //calculate the new total directly inside the database
        await _context.Database.ExecuteSqlRawAsync(
            "UPDATE Patients SET TotalSpent = TotalSpent + {0} WHERE Id = {1}",
            request.TotalPrice, patient.Id
        );

        // 4. Update Medicine Stock
        var medicine = await _context.Medicines
            .FirstOrDefaultAsync(m => m.Name == request.MedicineName);

        if (medicine != null)
        {
            medicine.StockQuantity -= request.Quantity;
        }

        // Save History and Stock changes
        await _context.SaveChangesAsync();

        return Ok();
    }

    public class PurchaseRequest
    {
        public string PatientPhone { get; set; } = string.Empty;
        public string MedicineName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal TotalPrice { get; set; }
    }
    // GET: api/Patients/AllSales
    [HttpGet("AllSales")]
    public async Task<ActionResult<IEnumerable<PurchaseHistory>>> GetAllSales()
    {
        // This pulls from the ACTUAL sales table where medicine is recorded
        return await _context.PurchaseHistory.OrderByDescending(h => h.PurchaseDate).ToListAsync();
    }
}