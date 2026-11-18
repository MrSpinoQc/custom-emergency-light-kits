# Installer CELK 0.2.0-rc.1 sur FiveM

> [!NOTE]
> **Archive.** Ce guide accompagne la version indiquée ci-dessous. [Installer la préversion actuelle](../0.3.1/INSTALLATION.md)

**Par Spino.** Ce guide installe le script **0.2.0-rc.1** avec le pack **Phantom Grand Format 0.1.0**, montage Police pour le Phantom GTA (`phantom`).

[ZIP du script](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-script-0.2.0-rc.1.zip) · [ZIP du pack Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/3f5ba2aba6c66d9fecd1b63792cd6931f8e14f1c/telechargements/CELK-phantom-grand-format-0.1.0-revue-2.2.zip) · [SHA-256 des deux ZIP](SHA256SUMS.txt) · [Dépendances et intégrations](../../COMPATIBILITE.md)

> [!IMPORTANT]
> **Essentiel** · un serveur FiveM opérationnel avec FXServer **38435 ou plus récent**, GTA build serveur **3889 ou plus récente**, **OneSync** et le moteur **Node.js 22 fourni par FXServer**. CELK s’installe en mode autonome avec le pack Phantom. Les groupes ACE servent à donner accès à ses commandes.

> [!WARNING]
> ⚠️ ATTENTION — TRÈS IMPORTANT : démarrer les packs avant CELK
>
> Au démarrage, CELK vérifie les packs requis. Si un pack manque, les modèles qui en dépendent sont suspendus. Démarre ce pack, puis redémarre `celk_runtime` pour les charger.

```cfg
ensure celk_pack_phantom
ensure celk_runtime
```

## 1. Préparer le serveur et les fichiers

1. Vérifie que ton serveur accepte déjà une connexion depuis FiveM. Pour créer une instance d’essai, utilise la configuration officielle txAdmin et une clé serveur Cfx valide. [Démarrer un serveur avec txAdmin](https://docs.fivem.net/docs/server-manual/setting-up-a-server-txadmin/)
2. Télécharge les deux ZIP ci-dessus. Vérifie leurs empreintes avant extraction. Sur Windows, exécute `Get-FileHash -Algorithm SHA256 -LiteralPath "<chemin du ZIP>"` pour chaque fichier. Compare avec la ligne qui porte exactement le même nom. [Empreintes SHA-256](SHA256SUMS.txt)

## 2. Installer les ressources dans la bonne instance

1. Ouvre **Settings → FXServer** dans txAdmin. Repère **Server Data Folder** et **CFG File Path** pour le serveur ciblé. Ouvre le dossier `resources` existant dans le répertoire des données serveur. Un chemin de CFG relatif se lit à partir de ce répertoire. Un chemin absolu désigne directement le fichier actif. Sur un hébergement géré, relève les deux emplacements dans le panneau de l’instance. [Réglages txAdmin](https://github.com/citizenfx/txAdmin/blob/master/panel/src/pages/Settings/tabCards/fxserver.tsx) · [Organisation des ressources FiveM](https://docs.fivem.net/docs/scripting-manual/introduction/introduction-to-resources/)
2. Extrais les ZIP. Copie les dossiers `celk_runtime` et `celk_pack_phantom` dans `resources`. Garde leurs noms et vérifie que `fxmanifest.lua` est à la racine de chaque ressource.
3. Crée `celk_runtime/local`. Copie l’exemple `celk.config.example.json` sous `local/celk.config.json`. Ce fichier contient déjà la provenance du montage Phantom, le nom de ressource du pack, sa version et le SHA-256 de son manifeste.
4. Crée `celk_runtime/local/models`, puis copie dedans **le contenu** du dossier `Modele-Phantom` du ZIP Phantom. Le dossier `phantom` doit arriver directement sous `models`. Garde les deux JSON de la livraison ensemble.

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

## 3. Configurer le démarrage et les droits

Active OneSync dans les paramètres du serveur. Pour le build GTA, utilise 3889 ou conserve le build supérieur déjà configuré. Sur un serveur qui gère ces réglages dans le CFG, utilise `set onesync on` et `set sv_enforceGameBuild 3889`. Garde un seul réglage effectif pour chaque option. Dans le **CFG Editor** de txAdmin ou le fichier identifié à l’étape 2, ajoute les droits et l’ordre de démarrage. [Manifeste CELK](celk_runtime/fxmanifest.lua) · [Commandes serveur FiveM](https://docs.fivem.net/docs/server-manual/server-commands/)

```cfg
add_ace group.celk_operator celk.bind allow
add_ace group.celk_fitter celk.fit allow
add_ace group.celk_driver celk.drive allow

ensure celk_pack_phantom
ensure celk_runtime
```

Associe les personnes autorisées aux groupes de ton serveur. L’exemple suivant donne les trois droits à une seule personne sur un serveur d’essai. Pour un identifiant de type `license`, remplace `IDENTIFIANT_FIVEM` par la valeur qui suit `license:`. Pour un autre type d’identifiant, adapte aussi le préfixe.

```cfg
# Exemple de droits pour une personne sur un serveur d’essai
add_principal identifier.license:IDENTIFIANT_FIVEM group.celk_operator
add_principal identifier.license:IDENTIFIANT_FIVEM group.celk_fitter
add_principal identifier.license:IDENTIFIANT_FIVEM group.celk_driver
```

| Droit CELK | Usage |
| --- | --- |
| `celk.bind` | Associer un identifiant durable à un véhicule. |
| `celk.fit` | Ouvrir F6 et choisir un montage. |
| `celk.drive` | Utiliser J et Q pour les scènes et les éclats. |

Enregistre le CFG et redémarre l’instance d’essai. Vérifie dans **Live Console** que `celk_pack_phantom` démarre avant `celk_runtime`. [Console et éditeur txAdmin](https://docs.fivem.net/docs/resources/txAdmin/)

## 4. Activer le montage Phantom

Exécute ces commandes **une par une dans la console serveur**. Lis le résultat avant de passer à la suivante.

| Commande | Résultat à vérifier |
| --- | --- |
| `celk_preflight phantom` | `Précontrôle réussi.` Le contrôle lit la livraison et ses dépendances. Il laisse l’index actif en place. |
| `celk_activate phantom` | `Index écrit.` Pour une activation identique, `Activation idempotente. Index inchangé.` |
| `restart celk_runtime` | Le runtime recharge l’index. Le pack reste démarré. |
| `celk_status` | La console affiche `phantom`, la provenance `spino`, la révision `1` et une variante chargée pour le ZIP d’origine. |

## 5. Faire le premier essai dans GTA

1. Fais apparaître un Phantom avec ton outil d’administration. Si tu utilises le menu de jeu **txAdmin** avec la permission `menu.vehicle`, ouvre **Vehicle → Spawn** et entre `phantom`. [Menu en jeu txAdmin](https://docs.fivem.net/docs/resources/txAdmin/) · [Permissions txAdmin](https://docs.fivem.net/docs/resources/txAdmin/permissions/)
2. Au volant et à l’arrêt, ouvre la console client **F8** et saisis `celk_bind phantom-essai-01` avec le droit `celk.bind`. Choisis un identifiant unique par véhicule d’essai. Si tu recrées le même véhicule pour vérifier sa sauvegarde, réutilise cet identifiant.
3. Ferme F8 et sélectionne le montage Police dans **F6**. Ouvre **J** pour choisir une scène, puis utilise **Q** pour allumer et éteindre les éclats. Vérifie que les pièces sont visibles et que les effets s’éteignent. Les touches peuvent être réaffectées dans FiveM.

## Dépannage

<details>
<summary><strong>Le serveur démarre, mais CELK refuse de charger</strong></summary>

| Message ou symptôme | Vérification |
| --- | --- |
| `Démarrage refusé` ou commandes CELK inconnues | Lis le premier message dans Live Console. Vérifie `celk_runtime/local/celk.config.json`, les noms de dossiers et le manifeste du script. Vérifie OneSync et les versions de FiveM. |
| `Ressource absente ou arrêtée` ou `Modèle phantom suspendu` | Confirme que `celk_pack_phantom` est dans le bon dossier `resources`, avec son `fxmanifest.lua`, puis vérifie l’ordre des `ensure`. Redémarre CELK une fois le pack actif. |
| `Version FiveM du pack différente` | Confirme que `celk_pack_phantom` provient du ZIP **0.1.0**. |
| `Empreinte du manifeste du pack différente de la configuration` ou `Empreinte du pack différente` | Vérifie les SHA-256 des ZIP, puis compare le pack installé et l’exemple de configuration à l’archive vérifiée. Sur une copie d’essai, restaure le dossier complet du pack si ses fichiers diffèrent. |

</details>

<details>
<summary><strong>CELK démarre, mais F6 ne propose aucun montage</strong></summary>

- Si `celk_status` affiche `Aucun export activé`, vérifie que les deux JSON sont sous `local/models/phantom/spino-r1`, puis reprends le précontrôle et l’activation.
- Vérifie que tu conduis le véhicule GTA `phantom`, que tu es à l’arrêt pour la pose et que la liaison F8 a réussi.
- Vérifie les droits `celk.fit` et `celk.drive` du joueur et les raccourcis FiveM si **F6**, **J** ou **Q** sont déjà attribués ailleurs. Donne les versions et quelques lignes d’erreur expurgées dans ton signalement. [Signaler un problème](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues)

</details>

## Limites du multi-packs

<details>
<summary><strong>Configurer un autre modèle et connaître les limites</strong></summary>

Une entrée par modèle distinct dans `scopes` associe le modèle GTA à la provenance autorisée. Une entrée par pack distinct dans `packs` fournit son nom de ressource, sa version et le SHA-256 de `pack-manifest.json` en minuscules. Plusieurs modèles peuvent partager une seule entrée de pack. Démarre les ressources requises avant CELK dans le CFG, puis précontrôle et active le modèle concerné.

| Limite de 0.2.0-rc.1 | Maximum |
| --- | --- |
| Modèles GTA distincts par configuration | 128 |
| Packs distincts par configuration | 32 |
| Taille de `local/celk.config.json` | 32 Kio |
| Livraisons actives | 1 par modèle |
| Variantes | 64 par livraison |
| Pièces actives | 20 par véhicule |

Les diffusions calibrées, projecteurs et attaches sur os demandent une qualification propre à chaque modèle. [Contrôles de configuration](celk_runtime/server/runtime-config.js#L20-L45) · [Contrôles des variantes](celk_runtime/server/model-exports.js) · [Packs et intégrations](../../COMPATIBILITE.md)

</details>

## Mise à jour et retour arrière

Sauvegarde ensemble le script, les packs, le CFG et tout `celk_runtime/local`. Teste le changement sur une copie. La préversion lit l’index de 0.1.2 et écrit au format v2 au premier changement d’activation ou de retrait. Pour revenir à 0.1.2, conserve une copie de l’état récent puis restaure ensemble le script, les packs et les données d’avant la mise à jour.

<details>
<summary><strong>Retirer une variante ou restaurer une révision précise</strong></summary>

Pour retirer une variante, installe une nouvelle révision avec les variantes que tu veux garder. Pour retirer un modèle entier, utilise `celk_retire <modèle> confirm` dans la console serveur. Le retrait conserve les sauvegardes. Pour restaurer une livraison, fais `celk_preflight <modèle> <révision> <sha256-en-minuscules>` puis `celk_activate` avec les mêmes arguments. Redémarre CELK et vérifie `celk_status`.

</details>

**Multijoueur non testé.** Si tu essayes cette version avec plusieurs joueurs, note ce que voit chaque client au démarrage, au changement de scène ou après une reconnexion. [Retours multijoueurs](https://github.com/MrSpinoQc/custom-emergency-light-kits/issues/1)
