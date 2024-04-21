
import { inAppPurchase } from 'electron'
const PRODUCT_IDS = ['com.nabocorp.witsy.full_version', 'full_version']

export default class {

  install(): void {

    inAppPurchase.on('transactions-updated', (event: any, transactions: Electron.Transaction[]) => {

      // Check the parameters
      if (!Array.isArray(transactions)) {
        return
      }

      // Check each transaction
      for (const transaction of transactions) {
        const payment = transaction.payment

        switch (transaction.transactionState) {
          case 'purchasing':
            console.log(`Purchasing ${payment.productIdentifier}...`)
            break

          case 'purchased': {
            console.log(`${payment.productIdentifier} purchased.`)

            // Get the receipt url.
            const receiptURL = inAppPurchase.getReceiptURL()

            console.log(`Receipt URL: ${receiptURL}`)

            // Submit the receipt file to the server and check if it is valid.
            // @see https://developer.apple.com/library/content/releasenotes/General/ValidateAppStoreReceipt/Chapters/ValidateRemotely.html
            // ...
            // If the receipt is valid, the product is purchased
            // ...

            // Finish the transaction.
            inAppPurchase.finishTransactionByDate(transaction.transactionDate)

            break
          }

          case 'failed':

            console.log(`Failed to purchase ${payment.productIdentifier}.`)

            // Finish the transaction.
            inAppPurchase.finishTransactionByDate(transaction.transactionDate)

            break
          case 'restored':

            console.log(`The purchase of ${payment.productIdentifier} has been restored.`)

            break
          case 'deferred':

            console.log(`The purchase of ${payment.productIdentifier} has been deferred.`)

            break
          default:
            break
        }
      }
    })

  }

  async getProducts(): Promise<Electron.Product[]> {

    // Check if the user is allowed to make in-app purchase
    if (!inAppPurchase.canMakePayments()) {
      console.log('The user is not allowed to make in-app purchase.')
      return null
    }

    // Retrieve and display the product descriptions
    const products: Electron.Product[] = await inAppPurchase.getProducts(PRODUCT_IDS)

    // Check the parameters
    if (!Array.isArray(products) || products.length <= 0) {
      console.log('Unable to retrieve the product information.', products)
      return null
    }

    // Display the name and price of each product
    for (const product of products) {
      console.log(`The price of ${product.localizedTitle} is ${product.formattedPrice}.`)
    }

    // done
    return products

  }

  async purchase(selectedProduct: Electron.Product, selectedQuantity: number): Promise<boolean> {

    // Purchase the selected product
    const isPurchaseValid = await inAppPurchase.purchaseProduct(selectedProduct.productIdentifier, selectedQuantity)
    if (!isPurchaseValid) {
      console.log('The product is not valid.')
      return false
    }

    // done
    console.log('The payment has been added to the payment queue.')
    return true

  }

}
