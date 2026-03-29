namespace PharmacyManagementAPI.Models
{
    public class DrugInteraction
    {
        public int Id { get; set; }
        public string? Ingredient1 { get; set; }
        public string? Ingredient2 { get; set; }
        public string? Severity { get; set; } // e.g., "High", "Moderate"
        public string? WarningMessage { get; set; }
        //hey my team friends, I think we should add more than one ingredient to the interaction, because some interactions involve more than two medicines, so we can add a list of ingredients and then we can check if any of the ingredients in the list interact with each other, but for now I will stick with two ingredients for simplicity
    }
}