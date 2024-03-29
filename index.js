const express = require('express')
const mongoose = require('mongoose')
const path = require('path')
const cors = require('cors')
const bodyParser = require('body-parser')
const bcrypt = require('bcryptjs')
const app = express()
const jwt = require('jsonwebtoken')
const auth = require('./middleware/auth')
const { passwordStrength } = require('check-password-strength')
const { HelpModel, UserModel, TokenModel } = require('./models/model')
const { cloudinary } = require('./middleware/cloudinary')
const sendEmail= require('./middleware/sendEmail')
const crypto= require('crypto')
require('dotenv').config({path:'./.env'}) 
 
app.use(cors()) 
app.use(bodyParser.json({ limit: '20mb' }))
app.use(express.static('./build'))
app.use(bodyParser.urlencoded({ extended: true }))

const dataBase = "mongodb+srv://praveennegi:praveenitis@cluster0.yepvd.mongodb.net/?retryWrites=true&w=majority"

mongoose.connect(dataBase,
    { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("Mongoose is connected"))
    .catch(e => console.log('could not connect'))


app.get('/help', async (req, res) => {
    const currPage = Number(req.query.page)

    const rec = await HelpModel.find({}).limit(8).skip(8 * (currPage - 1))
    res.json(rec)
})

app.post('/help', auth, async (req, res) => {

    const avatar = await cloudinary.uploader.upload(req.body.fileURL, {
        folder: 'safe-stray-life',
        width: 188, height: 280
    })

    const newData = await new HelpModel({
        location: req.body.location,
        contact: req.body.contact,
        about: req.body.about,      
        img: {
            url: avatar.secure_url,
            publicID: avatar.public_id
        },
        user: req.user._id
    })

    await newData.save().then(() => {
        console.log('UPLOADED'),
            res.status(200).send('')
    }).catch(err => console.log(err, 'ERROR OCCURED'))
})

app.get('/volunteer', async (req, res) => {

    const currPage = Number(req.query.page)
    const rec = await UserModel.find({ volunteer: true }).limit(8).skip(8 * (currPage - 1))
    res.json(rec)
})


app.post('/login', async (req, res) => {
    
    const user = await UserModel.findOne({ user: req.body.user }).lean()
    if (!user) return res.json({ status: 'error', error: 'Register First.' })

    const passCheck = await bcrypt.compare(req.body.passwd, user.password)

    if (passCheck) {
        if(!user.verified){
            const emailToken= await TokenModel.findOne({userID: user._id});
            if(!emailToken){
                const emailToken= await new TokenModel({
                    userID: user._id,
                    token: crypto.randomBytes(32).toString('hex')
                }).save();
        
                const url= `${process.env.BASE_URL}users/${user._id}/verify/${emailToken.token}`
                await sendEmail(user.email, "Verify Email", url);
            } 
            return res.json({status: 'error', error: 'Email verification needed.'})
        }
        const token = jwt.sign({ id: user._id, username: user.user }, process.env.JWT_SECRET)
        return res.json({ status: 'ok', token })
    }
    res.json({ status: 'error', error: 'Invaild Password.' })
})

app.post('/register', async (req, res) => {
    
    const strength = passwordStrength(req.body.passwd).value
    if (req.body.user.length < 8)
        return res.json({ status: "error", error: "Username must be of 8 characters." })

    if (strength === 'Too Weak' || strength === 'Weak' || strength === 'Medium')
        return res.json({ status: 'error', error: 'Weak Password.' })

    const password = await bcrypt.hash(req.body.passwd, 10)
    
    try {
        const user= await UserModel.create({
            user: req.body.user, password, email: req.body.email
        })
        
        const emailToken= await TokenModel.create({
            userID: user._id,
            token: crypto.randomBytes(32).toString('hex')
        });
        
        const url= `Click to verify: ${process.env.BASE_URL}users/${user._id}/verify/${emailToken.token}`
        await sendEmail(user.email, "Verify Email Address", url)
        .then(() =>   { res.json({status:'ok', message: 'Verification mail sent.'})})
        .catch(err => { res.json({status:'ok', message: 'Faile to sent verification mail.'}) })

    } catch (err) {
        if (err.code === 11000)
            return res.json({ status: 'error', error: 'User Alredy Exists' })
        throw err
    }
})

app.post('/getprofile', auth, async (req, res) => {
    let posts
    if(req.user.user==='iamadmin') posts= await HelpModel.find({ verified: false })
    else posts= await HelpModel.find({ user: req.user._id })
    const data = req.user

    res.json({ data, posts })
})

app.post('/deletepost', async (req, res) => {
    await HelpModel.deleteOne({ _id: req.body.id })
    res.status(200).send('ok')
})

app.post('/edit-profile', auth, async (req, res) => {
    const user = await UserModel.findById(req.user._id)
    const { name, email, address, contact, gender, about, dob, fileURL } = req.body

    try {
        const avatar = await cloudinary.uploader.upload(fileURL, {
            folder: 'safe-stray-life',
            width: 188, height: 280
        })
        const updateUser = { name, email, address, contact, gender, about, dob, avatar: { publicID: avatar.public_id, url: avatar.secure_url } }

        await user.updateOne(updateUser)
        res.status(200).send('Profile Updated.')
    } catch (err) {
        console.log(err)
    }
})

app.post('/be-volunteer', auth, async (req, res) => {

    if (req.user.name === 'N/a') return res.json({ status: 'error', error: "Insufficient details. Update Profile First." })
    await req.user.updateOne({ volunteer: req.body.volunteer })
    res.send('volunteered')
})

app.get('/users/:id/verify/:token', async(req, res) => {
    
    try{

        const user= await UserModel.findOne({_id: req.params.id})
        if(!user) return res.json({status:'error', error:'Invalid Link'});
        const token= await TokenModel.findOne({userID: user._id, token: req.params.token})
        if(!token) return res.json({status: 'error', error:'Invalid Link'})
        await user.updateOne({verified: true})
        await token.remove()
        res.json({status: 'ok', message: 'User Verified.'})
    } catch(err){
        console.log('Error occured in user verification');
    }
}) 

app.post('/post/:id', async (req, res) => {
    console.log(req.params.id)
    const post = await HelpModel.findById(req.params.id)
    res.json({post})
})

app.post('/volunteer/:id', async (req, res) => {
    console.log(req.params.id, 'in volunteer')
    const post = await UserModel.findById(req.params.id)
    res.json({post})
})

// app.get('/', (req, res) => {
//     console.log('fetch')
//     res.sendFile(path.resolve(__dirname + '/index.html'))
// })

const port = process.env.PORT || 8000
app.listen(port, () => console.log(`SERVER RUNNING AT PORT ${port}`))