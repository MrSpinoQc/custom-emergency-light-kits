# Mises à jour et sauvegardes

L’administrateur choisit quand mettre à jour le script et les packs. Télécharge leurs archives séparément. Avant l’installation, lis les notes de version et relève les combinaisons compatibles ainsi que les changements de format, de chemin et de persistance.

Pour le script candidat 0.1.2, sauvegarde tout `celk_runtime/local`, notamment la configuration, les livraisons, l’index actif, l’historique et les montages installés. Conserve aussi les anciens ZIP et leurs empreintes.

1. Prépare une copie d’essai avec la même configuration et des sauvegardes représentatives. Garde les archives et empreintes de la version en service ainsi qu’une copie séparée des configurations personnalisées et des sauvegardes.
2. Installe les versions proposées sur la copie. Relis les anciennes sauvegardes. Vérifie les montages, les choix des véhicules et les paramètres personnalisés. Applique uniquement les migrations décrites pour cette combinaison. En cas de diagnostic ou de perte, conserve la sauvegarde et remets la version d’origine sur la copie.
3. Une fois les contrôles terminés, planifie la mise à jour serveur et conserve les versions antérieures jusqu’à validation du redémarrage.

## Passer de 0.1.1 à 0.1.2

Le pack Phantom 0.1.0 et les données locales gardent le même format. Après sauvegarde, arrête `celk_runtime`, remplace les fichiers du script par ceux du ZIP 0.1.2 en conservant `local/`, puis relance la ressource. Vérifie `celk_status` et relie un véhicule témoin avec son identifiant durable. Si un client voit des objets restés d’une ancienne session en 0.1.1, demande-lui de se reconnecter après la mise à jour.

## Retour arrière

Restaure la version compatible du script et des packs, la configuration documentée et, si une migration a changé le format, les données sauvegardées avant l’installation. Si des modifications ont été faites depuis, conserve d’abord leur copie et suis les instructions de la version pour les récupérer. Redémarre et vérifie la combinaison active et le chargement des montages.

## Activer ou reprendre une livraison de modèle

Dépose la nouvelle révision complète et ses fichiers de montage dans `local/models/<modèle>/<dossier>`. Lance `celk_preflight`, puis `celk_activate` après précontrôle réussi. Redémarre `celk_runtime` et consulte `celk_status`. Le lecteur compare les numéros de révision dans la provenance configurée et signale les contenus divergents qui ont le même numéro. L’index en service reste disponible si une livraison est refusée.

Sur le Phantom Police, le script 0.1.2 lit `model-export.json` et `livraison.json`. S’ils coexistent dans un même dossier, leurs octets doivent correspondre. Quand le contenu d’un modèle déjà installé change, utilise une nouvelle révision pour éviter un conflit. La compatibilité de cette version couvre la correspondance exacte du pack Atelier Phantom vers le pack FiveM Phantom 0.1.0. La prise en charge d’un autre pack demandera une évolution du script.

Pour revenir à une révision précise, ajoute `<modèle> <révision> <empreinte-minuscule>` à `celk_preflight`, puis à `celk_activate`. Redémarre la ressource après réussite. La révision reste épinglée au redémarrage. Pour revenir à la résolution ordinaire, fais une nouvelle activation sans les trois arguments après avoir relu le précontrôle.

## Reprendre un ancien montage Phantom

Le candidat documente la migration de l’ancien préréglage `phantom-police-atelier-4`. Dans une copie de test, place la sauvegarde source et son mappage explicite dans `local/migration/legacy-v1.json` et `local/migration/mapping.json`, puis utilise `celk_migrate <identifiant-durable>` en console. Suis les champs et le diagnostic décrits dans les notes livrées avec le script. La migration a été éprouvée sur une sauvegarde témoin avec 13 pièces choisies. Vérifie la restauration de tes propres choix sur la copie d’essai.

[Installation et contrôles txAdmin](INSTALLATION.md) · [Versions et empreintes](README.md#téléchargements).
