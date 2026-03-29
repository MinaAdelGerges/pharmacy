namespace PharmacyManagementAPI.Models
{
    public class Patient
    {
        public int Id { get; set; }
        public string? FullName { get; set; } // ? makes it optional, I think it seems good to have the full name as optional because some patients might not want to provide their full name
        public string PhoneNumber { get; set; } = string.Empty; // This is now our main search key. Like the kasion he always asks for my phone number, so I think it makes sense to use it as the main identifier for patients//we can  add points for patients based on their purchases, and then we can use the phone number to track their points and offer them discounts or rewards, but for now I will just use it as the main identifier for patients and not for the loyalty program,
                                                                // although I have not got any discounts from the kasion yet, me crying
        public string? Email { get; set; } // Optional field , although I think most patients will not provide their email, so I think it makes sense to make it optional, but we can use it for sending purchase receipts or promotional offers....but I will say in the future not for now
        public decimal TotalSpent { get; set; } = 0;//hey! this field is for tracking the total amount spent by the patient, which can be used for loyalty programs, discounts, and personalized offers but for now I Think using it to calculate the total benefits our pharmacy made for each patient, and then we can use it for financial reporting and analysis,
    }
}