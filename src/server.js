const express = require("express")
const bodyParser = require("body-parser")
const cors = require("cors")

const app = express()
const port = process.env.PORT || 3001

const stripe = require("stripe")(process.env.SK_TEST_KEY)
// const sgMail = require("@sendgrid/mail")
const helmet = require("helmet")

// sgMail.setApiKey(process.env.SENDGRID_API_KEY)

app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json())
app.use(helmet())

app.use(cors({ origin: "*" }))

app.get("/", (req, res) => res.json("Hello World!"))

app.get("/products", (req, res) => {
  stripe.products.list({ active: true }).then((lst) => res.send(lst))
})

app.get("/products/:id", (req, res) => {
  stripe.products.retrieve(req.params.id, (err, product) => {
    stripe.skus.list({ active: true }).then((skus) => {
      res.json(skus.data.filter((sku) => sku.product === product.id))
    })
  })
})

// app.post("/contact", (req, res) => {
//   const msg = {
//     to: "ba_testing@zohomail.com",
//     from: "ba_testing@zohomail.com",
//     subject: "Sending with Twilio SendGrid is Fun",
//     text: "Wow, we managed to send an email.",
//   }
//   sgMail
//     .send(msg)
//     .then(() => {
//       res.redirect("/")
//     })
//     .catch((err) => {
//       console.log(err.response.body)
//     })
// })

app.post("/create-checkout-session", async (req, res) => {
  let items = req.body
  // let user = req.body;

  // console.log(items)
  // console.log(user)
  const itemData = await getProductData(items)

  // itemData.then(data => console.log(data))
  console.log(itemData)

  // itemData.then((res) => console.log(res[0].price_data.product_data.name))

  // itemData.then((res) => (itemInfo = res))

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: itemData,
    mode: "payment",
    success_url: "http://localhost:3000/success",
    cancel_url: "http://locahost:3000/cancel",
  })

  console.log(session.id)
  res.json({ id: session.id })
})

async function getProductData(items) {
  return Promise.all(
    items.map((item) => {
      // console.log(item)
      const data = {
        price_data: {
          // product: item.productID,
          currency: "usd",
          product_data: { name: item.productName },
          unit_amount: item.price,
        },
        quantity: item.qt,
      }
      return data
    })
  ).then((data) => data)
}

app.post("/payment-intent", async (req, res) => {
  let items = req.body

  const getPrices = await getItems(items)
  let total = getTotal(getPrices, items)

  total.then(async (data) => {
    const paymentIntent = await stripe.paymentIntents
      .create({
        amount: data,
        currency: "usd",
        payment_method_types: ["card"],
        receipt_email: "ohndaniel@gmail.com",
      })
      .catch((err) => {
        console.log(err)
      })

    res.send({
      clientSecret: paymentIntent.client_secret,
    })
  })
})

app.post("/get-payment", async (req, res) => {
  let items = req.body
  const getPrices = await getItems(items)

  let total = getTotal(getPrices, items)

  total.then((data) => {
    res.send({
      prices: getPrices,
      total: data,
    })
  })
})

async function getTotal(skus, items) {
  let total = skus.reduce((accum, value) => {
    const findQt = items.find((val, index) => {
      return val.productID === value.id
    })
    return accum + value.price * findQt.qt
  }, 0)

  return total
}

async function getItems(items) {
  const getSkus = Object.keys(items)

  return Promise.all(
    getSkus.map((i) => {
      let item = items[i]
      return stripe.skus.retrieve(item.productID)
    })
  ).then((data) => data)
}

app.listen(port, () => console.log(`App listening at http://localhost:${port}`))
