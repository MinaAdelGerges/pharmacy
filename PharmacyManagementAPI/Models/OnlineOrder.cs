using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

public class OnlineOrder
{
    [Key]
    [DatabaseGenerated(DatabaseGeneratedOption.Identity)] // This tells EF SQL handles the ID
    public int Id { get; set; }

    [Required]
    public int UserId { get; set; }

    [Required]
    public string MedicineName { get; set; } = string.Empty;

    public int Quantity { get; set; }
    public decimal TotalPrice { get; set; }
    public DateTime OrderDate { get; set; } = DateTime.Now;
    public string ShippingAddress { get; set; } = string.Empty;
    public string PaymentMethod { get; set; } = "Cash";
    public string Status { get; set; } = "Processing";
}//hey! this is the online order model, I added some fields that I think are necessary for the online order, such as shipping address, payment method and status, but we can add more fields 
//fail there is something off but I did not know till now what is it, help! help! Help! I am so confused, I think I got a headache, I think I need to take a break!