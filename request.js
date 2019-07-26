exports.getAvailableProducts = function (event) {
    return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:cus="http://ServiceContracts.DMG.MultiChoice.Com/CustomerCare" xmlns:cus1="http://DataContracts.DMG.MultiChoice.Com/CustomerCare" xmlns:cus2="http://MessageContracts.DMG.MultiChoice.Com/CustomerCare">
    <soapenv:Header>
       <cus:Header>
          <cus1:IsSecuredConnRequired>false</cus1:IsSecuredConnRequired>
          <!--Optional:-->
          <cus1:UserName></cus1:UserName>
          <!--Optional:-->
          <cus1:Password></cus1:Password>
          <!--Optional:-->
          <cus1:Domain></cus1:Domain>
          <!--Optional:-->
          <cus1:AuditReferenceNumber></cus1:AuditReferenceNumber>
       </cus:Header>
    </soapenv:Header>
    <soapenv:Body>
       <cus2:GetAvailableProductsRequest>
          <!--Optional:-->
          <cus:DataSource>${event.dataSource}</cus:DataSource>
          <!--Optional:-->
          <cus:CustomerNumber>${0}</cus:CustomerNumber>
          <!--Optional:-->
          <cus:BusinessUnit>${event.BusinessUnit}</cus:BusinessUnit>
       </cus2:GetAvailableProductsRequest>
    </soapenv:Body>
 </soapenv:Envelope>`
}