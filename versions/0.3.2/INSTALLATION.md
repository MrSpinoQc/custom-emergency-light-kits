# Préparer un serveur CELK 0.3.2

Guide de la préversion FiveM. Le cœur conserve l’identifiant interne `0.3.2-prototype.1`. Les adaptateurs Qbox et LVC se téléchargent séparément si ton serveur utilise ces intégrations.

[Cœur CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-script-0.3.2.zip) · [Préparateur de dépôt 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/fe8cc4ad9bca20a5a4a85b9fc696e6586799afeb/telechargements/CELK-preparateur-depot-0.3.2.zip) · [Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-phantom-060a37bf.zip) · [Airport Bus](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-airbus-78be8891.zip) · [Kuruma](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/2b67b717dab6486deb1744418c48c2448d11d50b/telechargements/ensemble-kuruma-41340f59.zip)

[Adaptateur Qbox pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-Qbox-pour-0.3.2.zip) · [Adaptateur LVC pour CELK 0.3.2](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/10031f68e337d1d560d97d6e95aa7d19c9e345b4/telechargements/CELK-adaptateur-LVC-pour-0.3.2.zip) · [Empreintes](SHA256SUMS.txt) · [Notes de la préversion](https://github.com/MrSpinoQc/custom-emergency-light-kits/releases/tag/v0.3.2)

## Préparer les packs

Le parcours vérifié utilise Windows, **FXServer 38435**, **OneSync** et **GTA build serveur 3889**. Le lecteur utilise Node 22, fourni par FXServer. Le préparateur s’exécute en dehors de FiveM avec Node **24.22.1** dans le banc de référence.

1. Extraire le ZIP du préparateur dans un dossier local, puis extraire le cœur sous `runtime/` pour obtenir `runtime/celk_runtime/fxmanifest.lua`.
2. Créer `instance/packs/`. Extraire chaque ZIP de jeu en conservant son dossier complet, qui contient `installation.json`, `selection/` et `resources/`.
3. À la première installation, créer `instance/policy.json` avec la politique suivante pour les packs de Spino.

```json
{"schema":"tryagain.folder-admission","version":1,"trustedLocalPublishers":["spino"]}
```

Le choix de l’auteur autorisé relève de l’administrateur. Compare les fichiers téléchargés aux SHA-256 des notes de version.

4. Serveur arrêté, exécuter `node launcher.cjs --home instance` depuis le dossier du préparateur. Lire le résultat et le nom de génération dans `instance/CURRENT`. Le champ `folder` dans la sortie donne le chemin complet de la génération. Il contient `resources/` avec le lecteur et les packs, ainsi que `start-order.cfg`.

```cfg
ensure [celk-packs]
ensure celk_runtime
```

Pour ajouter un pack compatible après la configuration initiale, extraire son dossier dans `instance/packs/`, relancer la préparation et sélectionner la génération produite au redémarrage. Le préparateur génère les déclarations de packs et de modèles. Le CFG global garde les deux lignes de démarrage. Le changement de génération s’effectue au redémarrage du serveur.

### Démarrage avec ton gestionnaire FiveM

Utilise le dossier de génération (`instance/generations/<nom>`) comme dossier de données du serveur. Le CFG de ce profil démarre les ressources nécessaires, puis le groupe CELK et le lecteur dans l’ordre indiqué. Si tu utilises Qbox ou LVC, rends leurs ressources et les adaptateurs disponibles dans ce dossier de données avant le démarrage. Quand une nouvelle génération devient active, ton gestionnaire doit démarrer depuis ce nouveau dossier.

### Lancement automatique Windows

Pour le parcours autonome, le lanceur intègre lui-même les deux lignes de démarrage. Prépare un CFG de paramètres sous `instance/` avec les réglages propres au serveur, dont OneSync et le build. Le CFG automatique accepte les réglages du serveur. Les commandes `start`, `ensure`, `restart`, `stop`, `exec` et `quit` y sont refusées.

Dans `instance/launch.json`, renseigne le chemin absolu de `FXServer.exe`, l’identifiant exact de son artefact sous forme de chaîne et le chemin du CFG relatif à `instance/`. Remplace les deux valeurs d’empreinte par les SHA-256 minuscules de tes fichiers.

```json
{
  "schema": "tryagain.fxserver-launch",
  "version": 1,
  "coordinated": true,
  "fxserver": {
    "file": "C:/FXServer/FXServer.exe",
    "artifactVersion": "38435",
    "sha256": "<empreinte de FXServer.exe>"
  },
  "serverConfig": {
    "file": "server.cfg",
    "sha256": "<empreinte du CFG>"
  }
}
```

Dans PowerShell, `(Get-FileHash -Algorithm SHA256 -LiteralPath <fichier>).Hash.ToLowerInvariant()` donne l’empreinte à copier. Lorsque le serveur est arrêté et que le créneau est validé, lance `node launcher.cjs --home instance --start`. Pour Qbox ou LVC, suis le parcours avec ton gestionnaire FiveM.

## Ajouter les intégrations facultatives

| Combinaison | Installation |
| --- | --- |
| **Autonome** | Autorisations ACE `celk.bind`, `celk.fit`, `celk.drive`. Au volant à l’arrêt, lier le véhicule avec `/celk_bind <identifiant-durable>`, puis choisir le montage avec F6 et la scène avec J. |
| **Qbox** | Installer les versions éditeur Core **1.24.1**, Vehicles **1.4.2** et Garages **1.1.4**. Démarrer `celk_qbox_adapter` après les ressources Qbox et avant CELK. La sortie officielle du garage fournit l’identité du véhicule. Les commandes respectent la propriété, le siège conducteur et les métiers configurés. |
| **LVC** | Installer LVC **3.2.9 Rev2** et son RageUI éditeur. Copier le plugin CELK dans `lvc/PLUGINS/CELK/`. Configurer `community_id` pour ton serveur et activer `plugins_installed` dans les réglages LVC. Démarrer RageUI et LVC avant CELK. La route native LVC s’applique aux véhicules d’urgence. Le plugin gère le raccord CELK sur les civils équipés. |

Sans LVC, CELK reprend ses commandes et ses tonalités. Le réglage `setr celk_lvc_enabled 0` désactive aussi le raccord. Si le garage Qbox tourne avec l’adaptateur indisponible, CELK bloque les opérations Qbox côté serveur. Après un redémarrage du seul adaptateur, ranger puis ressortir le véhicule par le garage officiel.

[Qbox Core](https://github.com/Qbox-project/qbx_core/releases/tag/v1.24.1) · [Qbox Vehicles](https://github.com/Qbox-project/qbx_vehicles/releases/tag/v1.4.2) · [Qbox Garages](https://github.com/Qbox-project/qbx_garages/releases/tag/v1.1.4) · [LVC et RageUI](https://github.com/TrevorBarns/luxart-vehicle-control/releases/tag/3.2.9)

Sur le banc de qualification, le garage officiel utilisait `doorsLocked = false` sur le profil sans module de clés. Sur ton serveur, vérifie le réglage du garage et la gestion des clés de ton profil.

## Formats d’ensembles

Le dépôt utilise les ensembles FiveM complets qui contiennent `installation.json`, `selection/selection.celk` et les ressources déclarées. Un export de montage seul, une ressource seule ou une enveloppe incompatible est refusé. Les anciens ensembles gardent leurs guides et leurs téléchargements. La filière manuelle `legacy` ne couvre que les contrats et fichiers vérifiés, dont les formats historiques Phantom et Baller documentés par FiveM.

Avant une mise à jour, conserver le CFG, la politique de dépôt, les packs, la génération précédente et ses données locales. Tester la reprise de ses propres sauvegardes sur une copie et garder l’ancienne combinaison complète pour un retour arrière.

