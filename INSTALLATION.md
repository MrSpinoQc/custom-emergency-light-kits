# Installer CELK et Phantom Grand Format avec txAdmin

Ce guide installe le script candidat **0.1.2** et le pack **Phantom Grand Format 0.1.0** sur un serveur FiveM d’essai, avec le montage Police pour le Phantom GTA d’origine.

> [!WARNING]
> ⚠️ ATTENTION — TRÈS IMPORTANT : démarrer les packs avant CELK
>
> CELK lit le pack Phantom dès son démarrage. Le pack doit déjà être démarré.

```cfg
ensure celk_pack_phantom
ensure celk_runtime
```

## 1. Vérifier le serveur et récupérer les deux ZIP

- Côté serveur, le manifeste demande **FXServer 38435 ou plus récent**, **GTA build serveur 3889 ou plus récente** et **OneSync**. Les essais de démarrage ont utilisé Windows avec FXServer 38435 et la build GTA 3889. FXServer fournit le moteur Node.js 22 déclaré par le script. [Manifeste CELK](celk_runtime/fxmanifest.lua) · [Référence FiveM des manifestes](https://docs.fivem.net/docs/scripting-reference/resource-manifest/).
- Côté joueur, il faut GTA V et le client FiveM. Le pack utilise le modèle `phantom` disponible dans le jeu.
- Télécharge les deux ZIP et compare leur SHA-256 avant extraction. Depuis PowerShell, utilise `Get-FileHash -Algorithm SHA256 -LiteralPath "<chemin du ZIP>"` pour chaque fichier. [Téléchargements](README.md#téléchargements) · [Empreintes attendues](telechargements/SHA256SUMS.txt).

## 2. Repérer le bon dossier et le CFG actif

1. Ouvre le panneau txAdmin de l’instance FiveM que tu veux modifier. Dans **Settings → FXServer**, relève les champs **Server Data Folder** et **CFG File Path** de cette instance. Si tu as plusieurs serveurs ou profils, vérifie que le tableau de bord et la console correspondent au serveur choisi. [Réglages FXServer de txAdmin](https://github.com/citizenfx/txAdmin/blob/master/panel/src/pages/Settings/tabCards/fxserver.tsx).
2. Sur la machine serveur ou dans le gestionnaire de fichiers de l’hébergeur, ouvre le dossier indiqué par **Server Data Folder**, puis son dossier `resources` existant. C’est le répertoire des ressources de cette instance. [Organisation des ressources FiveM](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/).
3. Relève l’emplacement du CFG réellement chargé. Un **CFG File Path** relatif, comme `server.cfg`, se lit à partir de **Server Data Folder**. Si le réglage donne un chemin absolu, utilise ce chemin tel quel. Chez un hébergeur qui gère ces champs, repère les mêmes emplacements dans le panneau de l’instance. [Résolution du chemin dans txAdmin](https://github.com/citizenfx/txAdmin/blob/master/core/lib/fxserver/fxsConfigHelper.ts).

## 3. Installer les deux ressources et le montage

1. Extrais chaque ZIP. Copie le dossier `celk_pack_phantom` du ZIP du pack et le dossier `celk_runtime` du ZIP du script dans ton `resources` existant. Garde les noms exacts et place chaque `fxmanifest.lua` directement à la racine de son dossier de ressource.
2. Dans `celk_runtime`, crée le dossier `local`. Copie `celk.config.example.json` sous `local/celk.config.json`. Le fichier exemple pointe vers `celk_pack_phantom`, sa version 0.1.0 et l’empreinte du manifeste de ce pack.
3. Crée `celk_runtime/local/models`. Depuis le ZIP du pack, copie dans `models` le contenu de `Modele-Phantom`, c’est-à-dire le dossier `phantom` et ses fichiers. Garde le fichier d’export et le montage ensemble.

```text
resources/
├── celk_pack_phantom/
│   ├── fxmanifest.lua
│   ├── pack-manifest.json
│   └── stream/
└── celk_runtime/
    ├── fxmanifest.lua
    ├── celk.config.example.json
    └── local/
        ├── celk.config.json
        └── models/
            └── phantom/
                └── spino-r1/
                    ├── model-export.json
                    └── montage-phantom-runtime-v1.json
```

## 4. Modifier le CFG et redémarrer

Ouvre le CFG actif dans **CFG Editor**, si ton compte txAdmin y a accès, ou dans le gestionnaire de fichiers de ton serveur. Vérifie que OneSync est activé dans les réglages de l’instance. Sur une instance d’essai configurée avec le CFG, cet exemple utilise la build GTA des essais. Si ta configuration fixe déjà une build plus récente, conserve cette valeur et évite les directives en double. Mets les deux lignes `ensure` dans l’ordre indiqué, y compris par rapport aux autres fichiers appelés par `exec`. [Fonctions de txAdmin](https://docs.fivem.net/docs/resources/txAdmin/) · [Commandes serveur FiveM](https://docs.fivem.net/docs/server-manual/server-commands/).

```cfg
set onesync on
set sv_enforceGameBuild 3889
add_ace group.celk_operator celk.bind allow
add_ace group.celk_fitter celk.fit allow
add_ace group.celk_driver celk.drive allow
ensure celk_pack_phantom
ensure celk_runtime
```

Les lignes `add_ace` accordent les droits aux groupes. Associe les personnes autorisées à ces groupes selon la gestion des accès de ton serveur. Enregistre le CFG et redémarre l’instance depuis txAdmin. Ouvre **Live Console** et vérifie que le pack démarre avant CELK. Les droits de la console et de l’éditeur sont configurés dans txAdmin. [Permissions txAdmin](https://docs.fivem.net/docs/resources/txAdmin/permissions/).

## 5. Activer et vérifier le montage

Exécute les commandes suivantes **une par une dans Live Console**, en vérifiant le résultat de chaque étape.

| Commande | Résultat à contrôler |
| --- | --- |
| `celk_preflight` | Contrôle les fichiers de la livraison sans écrire l’index actif. Attends `Précontrôle réussi.` |
| `celk_activate` | Vérifie à nouveau la livraison et écrit l’index local. Attends `Index écrit.` et l’invitation à redémarrer CELK. |
| `restart celk_runtime` | Redémarre uniquement CELK pour charger l’index. Le pack doit rester démarré. |
| `celk_status` | Vérifie que le modèle `phantom`, l’auteur de la livraison `spino`, la révision `1` et une variante active sont affichés. |

Dans GTA, installe-toi au volant d’un Phantom à l’arrêt. Avec la permission `celk.bind`, saisis `celk_bind <identifiant-durable>` dans F8. Réutilise le même identifiant quand le même véhicule est recréé. **F6** ouvre les montages avec `celk.fit`. **J** et **Q** permettent de choisir les scènes et les éclats avec `celk.drive`.

## 6. Lire un refus de démarrage

Cherche `Démarrage refusé` dans **Live Console** ou dans les journaux du serveur. Les commandes CELK sont enregistrées après les vérifications de démarrage. Si elles sont inconnues, commence par le premier message de refus.

| Message ou symptôme | Contrôle à faire |
| --- | --- |
| `Démarrer le pack celk_pack_phantom avant celk_runtime` ou ressource introuvable | Vérifie la racine `resources` de l’instance, les noms des deux dossiers, leurs `fxmanifest.lua` et l’ordre des lignes `ensure` dans le CFG actif. |
| `Version FiveM du pack différente` | Vérifie que la ressource démarrée provient du ZIP Phantom 0.1.0 et que sa version correspond à `local/celk.config.json`. |
| `Empreinte du manifeste du pack différente de la configuration` | Compare le `pack-manifest.json` installé avec celui du ZIP et la valeur dans `celk.config.example.json`. Restaure les fichiers issus de la paire annoncée. |
| `Empreinte du pack différente`, `Inventaire du pack incomplet` ou `Flux inattendu dans le pack` | Vérifie le SHA-256 du ZIP puis restaure le dossier complet `celk_pack_phantom` depuis cette archive. Le manifeste fixe la liste et l’empreinte de chaque fichier contrôlé. |
| Le précontrôle signale un export ou un montage absent | Vérifie `local/models/phantom/spino-r1` et la présence des deux JSON. Relance `celk_preflight` après correction. |

Après correction du CFG, du pack ou des fichiers, redémarre l’instance pour retrouver l’ordre pack puis CELK et relance les contrôles. [Démarrage et commandes CELK](celk_runtime/server/main.js) · [Contrôles du pack](celk_runtime/server/packs.js).

Le script 0.1.2 est limité au montage Police du Phantom et au pack 0.1.0. Le démarrage vérifie le modèle, le pack et les fichiers attendus. Ajouter un autre pack exigera une évolution du script. La synchronisation à deux clients reste non validée et l’essai est différé sans échéance.

Pour conserver une installation existante, suis le [guide de mise à jour et de sauvegarde](MISES-A-JOUR.md).
