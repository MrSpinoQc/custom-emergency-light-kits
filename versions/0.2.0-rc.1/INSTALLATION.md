# Installer CELK 0.2.0-rc.1

Version d’essai de **Custom Emergency Light Kits**, par **Spino**. Le script se télécharge séparément du pack. Le parcours public documenté ici utilise le Phantom Grand Format 0.1.0, montage Police. [Télécharger le pack Phantom](https://raw.githubusercontent.com/MrSpinoQc/custom-emergency-light-kits/main/telechargements/CELK-phantom-grand-format-0.1.0-revue-2.2.zip)

> [!WARNING]
> ⚠️ ATTENTION — TRÈS IMPORTANT : démarrer les packs avant CELK
>
> Toutes les ressources de packs utilisées par les montages doivent démarrer avant le script.

```cfg
ensure celk_pack_phantom
ensure celk_runtime
```

## Installation d’essai

1. Utilise FXServer **38435 ou supérieur**, GTA build serveur **3889 ou supérieure**, **OneSync** et le moteur **Node 22** fourni par FXServer.
2. Dans txAdmin, repère le **Server Data Folder** et le **CFG File Path** de ton instance. Copie les dossiers `celk_pack_phantom` et `celk_runtime` depuis les deux ZIP dans le dossier `resources` existant. Chaque `fxmanifest.lua` doit se trouver directement dans son dossier de ressource. [Repères txAdmin et permissions ACE](https://github.com/MrSpinoQc/custom-emergency-light-kits/blob/main/INSTALLATION.md#2-repérer-le-bon-dossier-et-le-cfg-actif)
3. Crée `celk_runtime/local`. Copie `celk.config.example.json` sous `local/celk.config.json`. L’exemple configure le Phantom et l’empreinte exacte de son pack. Depuis le ZIP Phantom, copie le contenu de `Modele-Phantom` dans `celk_runtime/local/models`. Tu dois retrouver `local/models/phantom/spino-r1/model-export.json` à côté du JSON de montage.
4. Dans le CFG réellement chargé, place les deux `ensure` dans l’ordre indiqué et configure les ACE `celk.bind`, `celk.fit` et `celk.drive` selon les droits de ton serveur. Redémarre l’instance d’essai et ouvre **Live Console**.
5. Exécute `celk_preflight phantom`. Si le précontrôle réussit, exécute `celk_activate phantom`, puis `restart celk_runtime`. Utilise `celk_status` pour vérifier que la livraison Phantom est chargée.
6. Au volant d’un Phantom arrêté, attribue l’identifiant durable du véhicule avec `celk_bind <identifiant>` dans F8. **F6** choisit le montage, **J** la scène et **Q** commande les éclats avec les droits appropriés.

Pour un autre modèle, configure sa provenance dans `scopes` et les packs qu’il exige dans `packs`, avec leur version, leur nom de ressource et le SHA-256 de leur `pack-manifest.json`. Ajoute une livraison compatible, puis précontrôle et active uniquement le modèle concerné. Les diffusions calibrées, les projecteurs et les attaches sur os demandent un raccord propre à chaque nouveau modèle.

## Mise à jour et retour arrière

Teste la mise à jour sur une copie. Sauvegarde ensemble le script, les packs, le CFG et tout `celk_runtime/local`. Le candidat lit l’index de 0.1.2 et écrit au format v2 au premier changement d’activation ou de retrait. Pour revenir à 0.1.2, conserve à part l’état récent puis restaure la copie complète d’avant la mise à jour.

Pour retirer une variante, installe une nouvelle révision avec les variantes restantes. Pour retirer un modèle entier, utilise `celk_retire <modèle> confirm` depuis la console serveur. Le retrait conserve les choix sauvegardés. Pour restaurer une livraison, utilise `celk_preflight <modèle> <révision> <sha256-en-minuscules>` puis `celk_activate` avec les mêmes arguments. Après réussite, redémarre uniquement CELK et vérifie `celk_status`.

**Multijoueur non testé.** Si tu essayes cette version avec plusieurs joueurs, note ce que voit chaque client au démarrage, au changement de scène ou après une reconnexion.
