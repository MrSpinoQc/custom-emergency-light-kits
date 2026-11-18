# Préparer un serveur CELK 0.3.2

Guide de la préversion FiveM. Le cœur conserve l’identifiant interne `0.3.2-prototype.1`. Les adaptateurs CELK Qbox et LVC portent la version **0.3.3** et se téléchargent séparément.

[Cœur CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-script-0.3.2.zip) · [Préparateur de dépôt 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-preparateur-depot-0.3.2.zip) · [Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-phantom-060a37bf.zip) · [Airport Bus](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-airbus-78be8891.zip) · [Kuruma](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-kuruma-41340f59.zip)

[Adaptateur Qbox 0.3.3](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-adaptateur-Qbox-0.3.3.zip) · [Adaptateur LVC 0.3.3](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-adaptateur-LVC-0.3.3.zip) · [Empreintes](SHA256SUMS.txt) · [Notes de la préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2)

## Préparer les packs

Le parcours vérifié utilise Windows, **FXServer 38435**, **OneSync** et **GTA build serveur 3889**. Le lecteur utilise Node 22, fourni par FXServer. Le préparateur s’exécute en dehors de FiveM avec Node **24.22.1** dans le banc de référence.

1. Extraire le ZIP du préparateur dans un dossier local, puis extraire le cœur sous `runtime/` pour obtenir `runtime/celk_runtime/fxmanifest.lua`.
2. Créer `instance/packs/`. Extraire chaque ZIP de jeu en conservant son dossier complet, qui contient `installation.json`, `selection/` et `resources/`.
3. À la première installation, créer `instance/policy.json` avec la politique suivante pour les packs de Spino.

```json
{"schema":"tryagain.folder-admission","version":1,"trustedLocalPublishers":["spino"]}
```

Le choix de l’auteur autorisé relève de l’administrateur. Compare les fichiers téléchargés aux SHA-256 des notes de version.

4. Serveur arrêté, exécuter `node launcher.cjs --home instance` depuis le dossier du préparateur. Lire le résultat et le nom de génération dans `instance/CURRENT`. Utiliser les ressources et l’ordre de démarrage de cette génération.

```cfg
ensure [celk-packs]
ensure celk_runtime
```

Pour ajouter un pack compatible après la configuration initiale, extraire son dossier dans `instance/packs/`, relancer la préparation et sélectionner la génération produite au redémarrage. Le préparateur génère les déclarations de packs et de modèles. Le CFG global garde les deux lignes de démarrage. Le changement de génération s’effectue au redémarrage du serveur.

Le lancement Windows automatisé du serveur autonome demande une configuration unique `instance/launch.json` qui épingle les chemins, la version de l’artefact et les SHA-256 du binaire et du CFG. Il se lance avec `node launcher.cjs --home instance --start`. Avec Qbox ou LVC, utiliser le gestionnaire de serveur habituel avec la génération préparée et démarrer les ressources tierces dans l’ordre ci-dessous.

## Ajouter les intégrations facultatives

| Combinaison | Installation |
| --- | --- |
| **Autonome** | Autorisations ACE `celk.bind`, `celk.fit`, `celk.drive`. Au volant à l’arrêt, lier le véhicule avec `/celk_bind <identifiant-durable>`, puis choisir le montage avec F6 et la scène avec J. |
| **Qbox** | Installer les versions éditeur Core **1.24.1**, Vehicles **1.4.2** et Garages **1.1.4**. Démarrer `celk_qbox_adapter` **0.3.3** après les ressources Qbox et avant CELK. La sortie officielle du garage fournit l’identité du véhicule. Les commandes respectent la propriété, le siège conducteur et les métiers configurés. |
| **LVC** | Installer LVC **3.2.9 Rev2** et son RageUI éditeur. Copier le plugin CELK **0.3.3** dans `lvc/PLUGINS/CELK/`. Configurer `community_id` pour ton serveur et activer `plugins_installed` dans les réglages LVC. Démarrer RageUI et LVC avant CELK. La route native LVC s’applique aux véhicules d’urgence. Le plugin gère le raccord CELK sur les civils équipés. |

Sans LVC, CELK reprend ses commandes et ses tonalités. Le réglage `setr celk_lvc_enabled 0` désactive aussi le raccord. Si le garage Qbox tourne avec l’adaptateur indisponible, CELK bloque les opérations Qbox côté serveur. Après un redémarrage du seul adaptateur, ranger puis ressortir le véhicule par le garage officiel.

[Qbox Core](https://github.com/Qbox-project/qbx_core/releases/tag/v1.24.1) · [Qbox Vehicles](https://github.com/Qbox-project/qbx_vehicles/releases/tag/v1.4.2) · [Qbox Garages](https://github.com/Qbox-project/qbx_garages/releases/tag/v1.1.4) · [LVC et RageUI](https://github.com/TrevorBarns/luxart-vehicle-control/releases/tag/3.2.9)

Sur le banc de qualification, le garage officiel utilisait `doorsLocked = false` sur le profil sans module de clés. Sur ton serveur, vérifie le réglage du garage et la gestion des clés de ton profil.

## Formats d’ensembles

Le dépôt utilise les ensembles FiveM complets qui contiennent `installation.json`, `selection/selection.celk` et les ressources déclarées. Un export de montage seul, une ressource seule ou une enveloppe incompatible est refusé. Les anciens ensembles gardent leurs guides et leurs téléchargements. La filière manuelle `legacy` ne couvre que les contrats et fichiers vérifiés, dont les formats historiques Phantom et Baller documentés par FiveM.

Avant une mise à jour, conserver le CFG, la politique de dépôt, les packs, la génération précédente et ses données locales. Tester la reprise de ses propres sauvegardes sur une copie et garder l’ancienne combinaison complète pour un retour arrière.

