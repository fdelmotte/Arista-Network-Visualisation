// Modules

const mod1 = require('./module1');
const express = require('express');
const morgan = require('morgan');
const twig = require('twig');
// const bodyParser = require('body-parser');

// Global variales
const app = express();
const PORT = 8090;

// Middlewares
app.use(morgan('dev'));

app.use(express.static(__dirname + '/public'));
app.use('/scripts', express.static(__dirname + '/node_modules'));

app.use(express.json());
app.use(express.urlencoded({ extended: true }))

// Routes
app.get('/',(req,res)=>{
    // res.sendFile(__dirname+'/views/index.html');
    res.render('index.twig', {author:'fbd'});
});


// Mise en place de la MAP par rapport au fichier
app.get('/cablingTheorical',async (req,res)=>{
    let resultat = await mod1.cablingFromFile()
    const [nodes,edges,linksInformations,nodesInformations]=resultat
    res.render('cablingMap.twig', {dataSend:{nodes:nodes,edges:edges,linksInformations:linksInformations,nodesInformations:nodesInformations}});
})

// Mise en place de la Map par rapport aux diff entre le fichier et le resultat de lldp
app.get('/cablingDiffFromLlpd',async (req,res)=>{
    let resultat = await mod1.cablingDiffFileVsLldp()
    const [nodes,edges,linksInformations,nodesInformations]=resultat
    res.render('cablingMap.twig', {dataSend:{nodes:nodes,edges:edges,linksInformations:linksInformations,nodesInformations:nodesInformations}});
})

// Mise en place de la Map par rapport au resultat LLDP depuis les spines
app.get('/lldpMapDynamic',(req,res)=>{
    linksInformations = {"totalLinks":0 ,"badLinks":0}
    nodesInformations = {"totalNodes":0 ,"badNodes":0}
    nodes = []
    edges = []
    res.render('lldpMapDynamicGet.twig', {dataSend:{nodes:nodes,edges:edges,linksInformations:linksInformations,nodesInformations:nodesInformations}})
})

// app.post('/lldpMapDynamicPost', async (req,res)=>{
//     let resultat = await mod1.lldpMapV3(req.body)
//     const [nodes,edges,linksInformations,nodesInformations]=resultat
//     res.render('lldpMapDynamicPost.twig', {dataSend:{nodes:nodes,edges:edges,linksInformations:0,nodesInformations:0}});
// })




app.listen(PORT,()=>console.log(`Started on port ${PORT}`));