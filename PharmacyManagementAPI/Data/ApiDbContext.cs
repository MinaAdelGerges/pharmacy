using Microsoft.EntityFrameworkCore;
using PharmacyManagementAPI.Models;

namespace PharmacyManagementAPI.Data
{
    public class ApiDbContext : DbContext
    {
        public ApiDbContext(DbContextOptions<ApiDbContext> options) : base(options) { }

        // This creates the "Medicines" table in SQL Server
        public DbSet<Medicine> Medicines { get; set; }

        // This creates the "pateint"& "pateintHistory"& "DrugInteraction" (hey all what you will find below I got tired writting..) table in SQL Server
        public DbSet<Patient> Patients { get; set; }
        public DbSet<PurchaseHistory> PurchaseHistory { get; set; }

        public DbSet<DrugInteraction> DrugInteractions { get; set; }
        public DbSet<User> Users { get; set; }
        public DbSet<Supplier> Suppliers { get; set; }
        public DbSet<PurchaseOrder> PurchaseOrders { get; set; }
        public DbSet<OnlineOrder> OnlineOrders { get; set; }
    }
}