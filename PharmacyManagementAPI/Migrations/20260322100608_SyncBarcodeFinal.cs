using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace PharmacyManagementAPI.Migrations
{
    public partial class SyncBarcodeFinal : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // We ONLY keep the Barcode addition. 
            // We removed CreateTable for Patients, History, and Interactions 
            // because they are already in your SQL database.
            migrationBuilder.AddColumn<string>(
                name: "Barcode",
                table: "Medicines",
                type: "nvarchar(max)",
                nullable: false,
                defaultValue: "");
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "Barcode",
                table: "Medicines");
        }
    }
}