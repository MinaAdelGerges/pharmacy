using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PharmacyManagementAPI.Data;   
using PharmacyManagementAPI.Models; 

namespace PharmacyManagementAPI.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class SuppliersController : ControllerBase
    {
        private readonly ApiDbContext _context;

        public SuppliersController(ApiDbContext context)
        {
            _context = context;
        }

        // 1. GET: api/Suppliers
        [HttpGet]
        public async Task<ActionResult<IEnumerable<Supplier>>> GetSuppliers()
        {
            return await _context.Suppliers.ToListAsync();
        }

        // 2. POST: api/Suppliers
        [HttpPost]
        public async Task<ActionResult<Supplier>> PostSupplier(Supplier supplier)
        {
            _context.Suppliers.Add(supplier);
            await _context.SaveChangesAsync();
            return Ok(supplier);
        }

        // 3. DELETE: api/Suppliers/
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteSupplier(int id)
        {
            var supplier = await _context.Suppliers.FindAsync(id);
            if (supplier == null) return NotFound();

            _context.Suppliers.Remove(supplier);
            await _context.SaveChangesAsync();
            return NoContent();
        }

        // 4. POST: api/Suppliers/RecordShipment
        [HttpPost("RecordShipment")]
        public async Task<IActionResult> RecordShipment(PurchaseOrder order)
        {
            // A. Save the purchase record to history
            _context.PurchaseOrders.Add(order);

            // B. Find the medicine in the inventory
            var medicine = await _context.Medicines.FindAsync(order.MedicineId);

            if (medicine != null)
            {
                // C. Increment the stock quantity by the amount received
                medicine.StockQuantity += order.QuantityReceived;
                _context.Entry(medicine).State = EntityState.Modified;
            }

            await _context.SaveChangesAsync();
            return Ok(new { message = "Stock updated successfully" });
        }

        // 5. GET: api/Suppliers/PurchaseHistory
        [HttpGet("PurchaseHistory")]
        public async Task<IActionResult> GetPurchaseHistory()
        {
            var history = await _context.PurchaseOrders
                .Select(p => new
                {
                    p.Id,
                    p.OrderDate,
                    p.QuantityReceived,
                    p.CostPrice,
                    //opps it seems we forgot to include the medicine and supplier names in the PurchaseOrder model, so we have to do it manually here
                    // We manually join the names so React doesn't have to do it///I think this is the only way to do it because we are not using EF Core's navigation properties, so we have to do it manually
                    MedicineName = _context.Medicines
                                    .Where(m => m.Id == p.MedicineId)
                                    .Select(m => m.Name)
                                    .FirstOrDefault(),
                    SupplierName = _context.Suppliers
                                    .Where(s => s.Id == p.SupplierId)
                                    .Select(s => s.Name)
                                    .FirstOrDefault()
                })//actully it worked !!! Good job me, I am so smart, I am so smart, S-M-R-T!
                .OrderByDescending(p => p.OrderDate)
                .ToListAsync();

            return Ok(history);
        }
        // PUT: api/Suppliers/5
        [HttpPut("{id}")]
        public async Task<IActionResult> PutSupplier(int id, Supplier supplier)
        {
            // Safety check: Does the ID in the URL match the ID in the data?
            if (id != supplier.Id)
            {
                return BadRequest("ID mismatch");
            }

            // Tell SQL this specific row has been changed so it can update it
            _context.Entry(supplier).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!_context.Suppliers.Any(e => e.Id == id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent(); // Success! wow congrats you did it, I made an update endpoint, I am a coding genius!!
        }
    }
}