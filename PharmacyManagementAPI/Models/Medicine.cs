namespace PharmacyManagementAPI.Models
{
    public class Medicine
    {
        public int Id { get; set; } // Unique ID for each medicine (the key), It's important to note that this ID is not the same as the barcode, which is a separate field that can be used for scanning and inventory management. The ID is primarily for database purposes and internal referencing, while the barcode is for external use and can be scanned at the point of sale or during inventory checks.
        public string Name { get; set; } = string.Empty; // Medicine name
        public string ActiveIngredient { get; set; } = string.Empty; // Critical for DDI checks, which are based on active ingredients rather than brand names. This allows the system to identify potential interactions even if different brands contain the same active ingredient.but I think should contain more than one active ingredient, because some medicines contain multiple active ingredients, so we can change this to a list of active ingredients and then we can check if any of the active ingredients interact with each other, but for now I will stick with one active ingredient for simplicity
        public decimal Price { get; set; } // Unit pricing
        public decimal BasePrice { get; set; }//I is not as the name implies, I put this for the discount engine, which calculates the discount based on the base price, which is the original price before any discounts are applied, and then the Price field is the final price that customers see after discounts, so we can use the BasePrice to calculate the discount percentage and then apply it to the Price field to get the final price that customers see, but for now I will just use it for the discount engine and not for sales transactions
                                              //but I think we should add another base price  or what we can call my team friends suggest the name here (------)that will be used for the profit margin calculations, which is the price we paid to the supplier, because the BasePrice is not the same as the cost price, which is the price we paid to the supplier, so we can add another field called CostPrice and then we can use it for profit margin calculations and financial reporting, but for now I will just use it for the discount engine and not for profit margin calculations
        public int StockQuantity { get; set; } // Current stock level
        public DateTime ExpiryDate { get; set; } // For the Waste Reducer Engine
        public string? Category { get; set; }
        public string? Barcode { get; set; } = string.Empty;

        public bool IsActive { get; set; } = true;
    }
}