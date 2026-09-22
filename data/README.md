# Inventory data (Excel / Sheets)

Use [`catalog.template.csv`](catalog.template.csv) as the master layout for Boutique La Différence products.

## How to connect

1. Open the template in **Microsoft Excel** or **Google Sheets**.
2. Replace example rows with real stock (`name`, `category`, `price`, `cost`, `barcode`, `stock`, …).
3. In the **admin portal** → **Excel / Sheets**:
   - Drop a `.xlsx` or `.csv` file, **or**
   - Paste a Google Sheet URL and click **Sync**.
4. The [public website](https://arnold-rg.github.io/Boutique-la-difference/) catalog updates from the same browser data store (or after sync on each device).

## Tools involved

- Microsoft Excel / Google Sheets — editing inventory  
- SheetJS — reading Excel in the browser  
- CSV export from Google Sheets — live sync URL  

See the main [README](../README.md) for the full technology list.
