const fs = require('fs');
const path = require('path');
const eAPI = require('eapi');
const IsOk = require('status-is-ok');


// Template pour le node - (visu-network format)
function templateNode () {
    return{
        id: '',
        label: '',
        level: '',
        title: '',
        image: '',
        shape: 'image'
    }
}
  
// Template pour le Edge - (visu-network format)
function templateEdge(){
    return{
        from: '',
        to: '',
        color: 'green',
        title: 'default'
    }
}

// Fonction permettant de lire le fichier referenceCabling.json
let readReferenceCabling = ()=>{
    return new Promise((resolve,reject)=>{
        fs.readFile(path.join(__dirname,'/public/map/referenceCabling.json'),'utf-8',(err,data)=>{
            if (err) {
                resolve("File not found or readable !!")
            } else {
                resolve(data)
            }
        });
    });
}

// Fonction permettant de remplir la table edges - (visu-network format)
function fillEdgeTemplate(device,remoteDevice,equipmentsIndex,edges,colorEdge,localPort,remotePort){
    // Init the variable for the  Edge template
    var t = templateEdge()
    // Find the device index
    let deviceIndex = equipmentsIndex.indexOf(device);
    let remoteIndex = equipmentsIndex.indexOf(remoteDevice);
    t.from = deviceIndex
    t.to = remoteIndex
    t.color = colorEdge
    t.title = `Eth${localPort} - Eth${remotePort}`
    edges.push(t)
}

// Fonction permettant de remplir la table nodes - (visu-network format)
function fillNodeTemplate(device,level,equipmentsIndex,nodes){
    // Retrouver l'index du device dans la table equipmentsIndex
    let deviceIndex = equipmentsIndex.indexOf(device);
    // Initialisation 
    var s = templateNode()
    s.id = deviceIndex
    s.label = device
    s.level = level
    s.title = device
    nodes.findIndex(x => x.id == s.id) === -1 && nodes.push(s)
}

// Statistic sur les liens
function globalLinkInformation(edges){
    const totalLinks = edges.length
    let badLinks = 0
    for (let link of edges){
      if(link.color ==='red'){
        badLinks++
      }
    }
    return ({"totalLinks":totalLinks ,"badLinks":badLinks})
}

// Statisctic sur les nodes
function globalNodeInformation(nodes){
    const totalNodes = nodes.length
    let badNodes = 0
    for (let node of nodes){
        if (node['image'].includes('red.png')){
        badNodes++
        }
    }
    return ({"totalNodes":totalNodes ,"badNodes":badNodes})

}

// Colorisation de l'icone du device
function colorNodeIcon (resultats,nodes){
    resultats.forEach((element,index) => {
        if (element === 200){
            nodes[index].image = "http://localhost:8090/images/green.png"
        }else{
            nodes[index].image = "http://localhost:8090/images/red.png"
        }
        
    });
}

// Promesse Globale pour les commandes Arista.
function promesseGlobaleEapi(cde,equipmentsPromesse){
    var devicesInit =[]

    for (let device of equipmentsPromesse){
        var deviceInit = new eAPI({
            host: device,
            proto: 'http',
            port: 80,
            user: 'dwarf',
            pass: 'arista',
            strict: true
        });
        devicesInit.push(deviceInit)
    }
    var fn = function deviceRequest(v){
        return new Promise((resolve,reject) =>{
            v.exec(cde, function(err, res){
                resolve(res)
                reject(err)
            });
        });
    };
    var actions = devicesInit.map(fn);
    var results = Promise.all(actions)
    
    return results
}


// Fonction permettant d'afficher une Map a partir du fichier referenceCabling.json
async function cablingFromFile(){
    console.log("start cablingFromFile ");
    
    const nodes = []
    const edges = []
    const equipmentsIndex = [] // Memorisation des equipements de facon unique

    // Lecture du fichier referenceCabling.json
    let data = await readReferenceCabling()
    // Le module fs renvoie le resultat en format string, il faut le convertir en json
    const mapDevices = JSON.parse(data);
    // Memorisation des "level" - Les "level" sont des cles dans le fichier referenceCabling.json 
    const mapLevels = Object.keys(mapDevices);

    // Debut du process
    for (let keyLevel of mapLevels){
        // Memorisation des devices utilises comme des cles pour le level (keyLevel)
        const keysDevice = Object.keys(mapDevices[keyLevel])
        // Debut process pour les devices presents dans le level - structure 1:{[leafxx],[2]}
        for (let device of keysDevice){
            for (const[key,value] of Object.entries(mapDevices[keyLevel][device])){
                // Memorisation du port local
                localPort = key
                // Memorisation du level
                localLevel = parseInt(keyLevel.split('level')[1])
                // Memorisation du remoteDevice et du remotePort
                const [remoteDevice,remotePort] = value
                // Definition de level du remoteDevice - keyLevel est 
                remoteLevel = (parseInt(keyLevel.split('level')[1]))+1
                // Verification de la presence du device dans equipmentsIndex
                if (equipmentsIndex.indexOf(device)===-1){
                    // Le device n'est pas present donc ajout
                    equipmentsIndex.push(device)
                    fillNodeTemplate(device,localLevel,equipmentsIndex,nodes)
                }
                // Verification de la presence du remoteDevice dans equipmentsIndex
                if (equipmentsIndex.indexOf(remoteDevice)===-1){
                    // Device no present donc ajout
                    equipmentsIndex.push(remoteDevice)
                    fillNodeTemplate(remoteDevice,remoteLevel,equipmentsIndex,nodes)
                }
                // Build the edges
                fillEdgeTemplate(device,remoteDevice,equipmentsIndex,edges,'green',localPort,remotePort)
            }
        }
    }

    // Promesse permettant de traiter le test des equipements en paralleles
    var fn = function testDevice(equipment){
        return new Promise((resolve,reject)=>{
            const isUrlOk = new IsOk()
            isUrlOk.check(`http://${equipment}`, (data,err)=>{
                if (err != undefined) {
                    resolve(err.status)
                }else{
                    resolve(err)
                }
            });
        });
    }
    var actions = equipmentsIndex.map(fn);
    var resultats = await Promise.all(actions)
    
    // Colorisation de l'icon du node
    colorNodeIcon(resultats,nodes)

    // Statistics concernant les nodes et edges
    let resultatLinks = await globalLinkInformation(edges)
    let resultatNodes = await globalNodeInformation(nodes)
    
    console.log('End of the function cablingFromFile')
    return ([nodes,edges,resultatLinks,resultatNodes]) 
}

// Fonction permettant d'afficher les differences entre la Map theorique et le resultat de lldp
async function cablingDiffFileVsLldp(){
    const equipmentsIndex = [] // Memorisation des equipements de facon unique
    const equipmentsPromesse = [] // Memorisation des equipements pour la promesse

    // Appel de la fonction permettant d'afficher la Map a partir du fichier referenceCabling.json
    let data = await cablingFromFile()
    // Affectation du resultat a nodes et edges - Structure du fichier referenceCabling.json pur visio-network
    const [nodes,edges] = data
    // Memorisation des switchs dans equipmentsIndex qui sont joignables
    for (let device of nodes){
        equipmentsIndex.push(device.label)
        if((device.image).search('green') !== -1){
            equipmentsPromesse.push(device.label)
        }
    }
    // Appel de le fonction permettant d'interroger les devices en parallele
    let resultat = await promesseGlobaleEapi(['show lldp neighbors'],equipmentsPromesse)
    
    for (let edgeItem of edges){
       edgesDevice = equipmentsIndex[edgeItem.from]
       promesseIndex = equipmentsPromesse.indexOf(edgesDevice)
       
       flagConditionLinkArray = false

        // Recherche dans le resultat de la promesse a l'index PromesseIndex
        for (let lldpInfo of resultat[promesseIndex][0]['lldpNeighbors']){
            lldpLocalPort = (lldpInfo.port).split('Ethernet')[1]
            lldpRemoteDeviceIndex = equipmentsIndex.indexOf(lldpInfo.neighborDevice)
            lldpRemotePort = (lldpInfo.neighborPort).split('Ethernet')[1]

            const conditionsLinkArray = [
                edgeItem.from == edgeItem.from,
                edgeItem.to == lldpRemoteDeviceIndex,
                (edgeItem.title).split(' ')[0].split('Eth')[1] == lldpLocalPort,
                (edgeItem.title).split(' ')[2].split('Eth')[1] == lldpRemotePort
            ]
            if (conditionsLinkArray.indexOf(false) === -1){
                flagConditionLinkArray = true
            }
        }
        if (flagConditionLinkArray == true){
            edgeItem.color = 'green'
        }else{
            edgeItem.color = 'red'
        }
    }
    let resultatLinks = await globalLinkInformation(edges)
    let resultatNodes = await globalNodeInformation(nodes)
    
    console.log('End of the function cablingDiffFileVsLldp')
    return ([nodes,edges,resultatLinks,resultatNodes])
}

// Fonction permettant de decouvrir la Map a partir des spines






// Export des fonctions
exports.cablingFromFile = cablingFromFile
exports.cablingDiffFileVsLldp = cablingDiffFileVsLldp