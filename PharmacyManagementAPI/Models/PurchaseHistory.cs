namespace PharmacyManagementAPI.Models
{
    public class PurchaseHistory
    {
        public int Id { get; set; }
        public int PatientId { get; set; }
        public string MedicineName { get; set; } = string.Empty;
        public int Quantity { get; set; }
        public decimal TotalPrice { get; set; }
        public DateTime PurchaseDate { get; set; } = DateTime.Now;
    }
}