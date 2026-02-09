// --- 1. CONFIGURATION ET VARIABLES ---
const PRIX_NB = 0.10;
const PRIX_COULEUR = 0.30;
const SEUIL_DEGRESSIF = 50; 
const TAUX_REMISE = 0.80; // Correspond à -20%
let panier = [];
let paymentInterval; 

// Sélection des éléments HTML
const fileInput = document.getElementById('fileUpload');
const dropZone = document.getElementById('drop-zone');
const dropZoneText = document.querySelector('.drop-zone-text');
const inputPages = document.getElementById('nbPages');
const selectCouleur = document.getElementById('couleur');
const selectLivraison = document.getElementById('livraison');
const badge = document.getElementById('panier-badge');
const spanTotal = document.getElementById('prixTotal');
const listePanier = document.getElementById('listePanier');

// Modals et Loader
const modal = document.getElementById('paymentModal');
const loaderCommande = document.getElementById('loader-commande');
const cancelPayment = document.getElementById('cancel-payment');

// --- 2. GESTION DE L'UPLOAD PDF (CORRIGÉ) ---
if (dropZone && fileInput) {
    // Clique sur la zone pour ouvrir l'explorateur de fichiers
    dropZone.onclick = () => fileInput.click();

    // Changement de fichier
    fileInput.onchange = (e) => {
        if (fileInput.files.length > 0) {
            dropZoneText.textContent = fileInput.files[0].name;
            dropZone.style.borderColor = "var(--vert-moyen)";
        }
    };

    // Drag & Drop
    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.classList.add('drop-zone--over'); };
    dropZone.ondragleave = () => dropZone.classList.remove('drop-zone--over');
    dropZone.ondrop = (e) => {
        e.preventDefault();
        dropZone.classList.remove('drop-zone--over');
        if (e.dataTransfer.files.length > 0) {
            fileInput.files = e.dataTransfer.files;
            dropZoneText.textContent = e.dataTransfer.files[0].name;
        }
    };
}

// --- 3. CALCUL DU PRIX ET PANIER ---
document.getElementById('btnAjouterPanier').onclick = () => {
    const pages = parseInt(inputPages.value);
    const mode = selectCouleur.value;
    
    if (!fileInput.files.length) return alert("Veuillez sélectionner un fichier PDF.");
    if (isNaN(pages) || pages <= 0) return alert("Veuillez indiquer un nombre de pages valide.");

    let tarifUnitaire = (mode === 'bw' ? PRIX_NB : PRIX_COULEUR);
    let estPromo = (pages >= SEUIL_DEGRESSIF);
    if (estPromo) tarifUnitaire *= TAUX_REMISE;

    panier.push({
        nom: fileInput.files[0].name,
        prix: pages * tarifUnitaire,
        details: `${pages}p - ${mode === 'bw' ? 'N&B' : 'Couleur'}`,
        promo: estPromo
    });

    actualiserAffichage();
    
    // Reset du formulaire d'ajout
    fileInput.value = "";
    inputPages.value = "";
    dropZoneText.textContent = "Glissez vos PDF ici ou cliquez";
    dropZone.style.borderColor = "var(--vert-clair)";
};

function actualiserAffichage() {
    badge.textContent = panier.length;
    listePanier.innerHTML = "";
    let sousTotalHT = 0;

    if (panier.length === 0) {
        listePanier.innerHTML = '<p style="text-align: center; color: #999; padding: 20px;">Votre panier est vide</p>';
    }

    panier.forEach((art, i) => {
        sousTotalHT += art.prix;
        const promoLabel = art.promo ? `<small style="color:green; font-weight:bold;"> (-20%)</small>` : "";
        listePanier.innerHTML += `
            <div class="panier-item">
                <div><strong>${art.nom}</strong><br><small>${art.details}${promoLabel}</small></div>
                <span>${art.prix.toFixed(2)}€ <button onclick="supprimer(${i})" class="btn-supprimer">✕</button></span>
            </div>`;
    });

    let frais = 0;
    if (panier.length > 0) {
        const m = selectLivraison.value;
        frais = (m === 'poste' ? 1.5 : (m === 'relais' ? 2.5 : 5.0));
    }

    const tva = (sousTotalHT + frais) * 0.20;
    const totalTTC = sousTotalHT + frais + tva;

    document.getElementById('sousTotalHT').textContent = sousTotalHT.toFixed(2) + " €";
    document.getElementById('fraisLivraison').textContent = frais.toFixed(2) + " €";
    document.getElementById('tva').textContent = tva.toFixed(2) + " €";
    spanTotal.textContent = totalTTC.toFixed(2) + " €";
}

window.supprimer = (i) => { panier.splice(i, 1); actualiserAffichage(); };

// --- 4. ANIMATION IMPRIMANTE ET PAIEMENT ---
document.getElementById('btnCommander').onclick = () => {
    if (panier.length === 0) return alert("Le panier est vide !");

    // Lancement du loader imprimante
    loaderCommande.style.display = "block";
    const papier = document.getElementById('printer-paper');
    const corpsImprimante = document.querySelector('.printer-body');
    const statusText = document.getElementById('loader-status');
    
    corpsImprimante.classList.add('printer-vibrate');
    
    let height = 0;
    const intervalImprimante = setInterval(() => {
        height += 2;
        papier.style.height = height + "px";
        
        if (height === 50) statusText.textContent = "Traitement sécurisé...";
        if (height === 100) {
            clearInterval(intervalImprimante);
            corpsImprimante.classList.remove('printer-vibrate');
            
            setTimeout(() => {
                loaderCommande.style.display = "none";
                papier.style.height = "0px";
                // Ouverture du terminal de paiement
                document.getElementById('montantFinal').textContent = spanTotal.textContent;
                modal.style.display = "block";
            }, 500);
        }
    }, 30);
};

// --- 5. LOGIQUE DU TERMINAL DE PAIEMENT ---
cancelPayment.onclick = () => {
    modal.style.display = "none";
    resetTerminal();
};

document.getElementById('paymentForm').onsubmit = (e) => {
    e.preventDefault();
    const st = document.getElementById('terminalStatus');
    const pb = document.getElementById('progress-bar');
    const pc = document.getElementById('progress-container');
    
    document.getElementById('paymentForm').style.display = "none";
    pc.style.display = "block";
    st.textContent = "COMMUNICATION BANCAIRE...";
    
    let p = 0;
    paymentInterval = setInterval(() => {
        p += 5;
        pb.style.width = p + "%";
        if (p >= 100) {
            clearInterval(paymentInterval);
            st.textContent = "PAIEMENT ACCEPTÉ !";
            document.getElementById('successMessage').style.display = "block";
            cancelPayment.style.display = "none";
            
            setTimeout(() => {
                alert("Merci de votre confiance ! Votre commande est en cours d'impression.");
                location.reload();
            }, 2500);
        }
    }, 100);
};

function resetTerminal() {
    clearInterval(paymentInterval);
    document.getElementById('paymentForm').style.display = "block";
    document.getElementById('progress-container').style.display = "none";
    document.getElementById('successMessage').style.display = "none";
    document.getElementById('terminalStatus').textContent = "Insérez votre carte";
}

// --- 6. CARTE POINTS RELAIS ---
let map;
selectLivraison.onchange = () => {
    const rc = document.getElementById('relais-container');
    if (selectLivraison.value === 'relais') {
        rc.style.display = "block";
        if (!map) {
            map = L.map('map').setView([48.8566, 2.3522], 13);
            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);
        }
        setTimeout(() => map.invalidateSize(), 200);
    } else {
        rc.style.display = "none";
    }
    actualiserAffichage();
};