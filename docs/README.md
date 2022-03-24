# Opzet Mijn Nijmegen

De applicatie is opgebouwd uit een set Lambda functies die aanroepbaar zijn via een API Gateway die gekoppeld is aan een Cloudfront distributie:

![Mijn Nijmegen architectuurplaat](assets/mijnnijmegen.drawio.svg)

## Authenticatie
Authenticatie gaat via het OpenIDConnect-protocol, via https://authenticatie.nijmegen.nl. De /login en /auth routes zijn hiervoor verantwoordelijk.

## Afhankelijkheden
Aan de bestaande API Gateway kunnen nieuwe routes gekoppeld worden in externe projecten. Een voorbeeld is [Mijn Uitkering](https://github.com/gemeenteNijmegen/mijn-uitkering). Dit project is verder afhankelijk van een bestaande DNS Zone in AWS.
