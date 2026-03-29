namespace PharmacyManagementAPI.Models
{
    public class PurchaseOrder
    {
        public int Id { get; set; }
        public int MedicineId { get; set; }
        public int SupplierId { get; set; }
        public int QuantityReceived { get; set; }
        public decimal CostPrice { get; set; }
        public DateTime OrderDate { get; set; } = DateTime.Now;
    }
}
