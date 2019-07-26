'use strict';

const config = require('./config.json');
const apiLambdas = require('aws-core-utils/api-lambdas');
const sql = require('mssql');
const fastXmlParser = require('fast-xml-parser');
const http = require('./http-utils');
const soapRequest = require('./request');
const soap_ = require('underscore');
const AWS = require('aws-sdk');
let AWSXRay = require('aws-xray-sdk-core');


const options = {
  ignoreNameSpace: true
};

//  module.exports.handler = apiLambdas.generateHandlerFunction({}, undefined, require('./context-options.json'), getPriceAndProducts, 'debug', undefined);

exports.getPriceAndProducts = function getPriceAndProducts(event) {
  return Promise.all([createSQLConnection(), getCountriesFromAWSS3()]).then(promiseResponseResponse => {
    const s3Countries = promiseResponseResponse[1];
    const countriesBuffer = new Buffer(s3Countries.Body).toString("utf8");
    const countries = JSON.parse(countriesBuffer);

    const isDTHExist = countries.some(m => m.Country == config.BaseDTHCountry);
    let dthCountries = [{Country :config.BaseDTHCountry}];
    let nonDthCountries = [];
    let functionCalls = [];

    if(isDTHExist){
      nonDthCountries = countries.reduce((acc, value) => {
        if(value.Country != config.BaseDTHCountry){
          acc.push(value)
        };
        return acc;
      }, []);

      
      functionCalls = [updatePriceAndDateForDTHCountries(dthCountries),updateProductPricesAndDates(nonDthCountries)];
    }else{
      nonDthCountries = countries;
      functionCalls = [updateProductPricesAndDates(nonDthCountries)];
    }

    return Promise.all(functionCalls).then(allUpdatesResponse => { 
      sql.close();
      return allUpdatesResponse;
    })
  })
    .catch(err => {
      throw err;
    })
}


// function getPriceAndProducts(event) {
//   return Promise.all([createSQLConnection(), getCountriesFromAWSS3()]).then(promiseResponseResponse => {
//     const s3Countries = promiseResponseResponse[1];
//     const countriesBuffer = new Buffer(s3Countries.Body).toString("utf8");
//     const countries = JSON.parse(countriesBuffer);

//     const isDTHExist = countries.some(m => m.Country == config.BaseDTHCountry);
//     let dthCountries = [{Country :config.BaseDTHCountry}];
//     let nonDthCountries = [];
//     let functionCalls = [];

//     if(isDTHExist){
//       nonDthCountries = countries.reduce((acc, value) => {
//         if(value.Country != config.BaseDTHCountry){
//           acc.push(value)
//         };
//         return acc;
//       }, []);

      
//       functionCalls = [updatePriceAndDateForDTHCountries(dthCountries),updateProductPricesAndDates(nonDthCountries)];
//     }else{
//       nonDthCountries = countries;
//       functionCalls = [updateProductPricesAndDates(nonDthCountries)];
//     }

//     return Promise.all(functionCalls).then(allUpdatesResponse => { 
//       sql.close();
//       return allUpdatesResponse;
//     })
//   })
//     .catch(err => {
//       throw err;
//     })
// }

function createContext() {
  return { AWS: AWSXRay.captureAWS(require('aws-sdk')) }; // an AWS X-Rayed version of the AWS constructor function
}

function createSQLConnection() {
  return sql.connect(config.sqlconfig).then(connectionResponse => {
    return connectionResponse;
  }).catch(err => {
    throw err;// ... error checks
  })
  sql.on('error', err => {
    throw err;  // ... error handler
  })
}

function updateProductPricesAndDates(event) {
  return getAvailableProducts(event).then(getAvailableProductsResponse => {
    const updateCalls = getAvailableProductsResponse.map((value, index) => {
      //return value;
      return updatePriceAndDatePerCountry(value, undefined).then(updatePriceAndDatePerCountryResponse => {
        return updatePriceAndDatePerCountryResponse;
      })
    })
    return Promise.all(updateCalls);
  })
}

function getCountriesFromAWSS3() {
  return new Promise((resolve, reject) => {
    var s3 = new AWS.S3();
    var paramsCountries = { Bucket: config.s3Bucket, Key: config.s3Key };
    s3.getObject(paramsCountries, function (err, data) {
      if (err) {
        console.log(err, err.stack); // an error occurred
        reject(new Error(JSON.stringify({ customMessage: err.stack, envelope: err })))
      }
      resolve(data)
    })
  })
}

function getAvailableProducts(event) {
  // const jsonData = [{
	// 	"Id": 47,
	// 	"Country": "DTH_QA",
	// 	"countryCode": "TG"
	// }];
  const getAvailableProductCalls = event.map((value, index) => {
    const getAvailableProductsSoapRequest = {
      dataSource: value.Country,
      id: value.Id
    };

    return getAvailableProductsSoap(getAvailableProductsSoapRequest).then(getAvailableProductsSoapResponse => {
      return getAvailableProductsSoapResponse;
    })
  })

  return Promise.all(getAvailableProductCalls);
}

function getAvailableProductsSoap(event) {
  return new Promise((resolve, reject) => {
    const url = config.soapLink;

    const opts = {
      body: soapRequest.getAvailableProducts(event),
      timeoutMs: config.ServiceTimeOut,
      headers: {
        'content-type': 'text/xml',
        'SOAPAction': config.SOAPAction
      }
    };

    return http.post(url, opts)
      .then(res => {
        const response = res && res.response;
        const body = res && res.body;

        let jsonResponse = null;

        if (fastXmlParser.validate(res.body) === true) {
          jsonResponse = fastXmlParser.parse(res.body, options);
        } else {
          reject(new Error(JSON.stringify({ customMessage: 'Could not get the product details.', envelope: jsonResponse })));
          return;
        }

        if (response.statusCode === 200) {
          if (jsonResponse.Envelope.Body.GetAvailableProductsResponse) {
            const result = jsonResponse.Envelope.Body.GetAvailableProductsResponse.AvailableProductCollection.AvailableProduct;

            const info = result.map((value, index) => {
              value.dataSource = event.dataSource;
              value.id = event.id;
              return value;
            });

            resolve(info);
          } else {
            reject(new Error(JSON.stringify({ customMessage: 'Could not get the product details.', envelope: jsonResponse })))
          }
        }
      })
      .catch(err => {
        reject(err);
      });
  })
}

function updatePriceAndDateForDTHCountries(event) {
  return getAvailableProducts(event).then(getAvailableProductsResponse => {
    const dthCountries = config.DTHCountries; //[]

    let dthFunctionCall = dthCountries.map(dthItem => {
      const dthProducts = getAvailableProductsResponse[0];
      return updatePriceAndDatePerCountry(dthProducts, dthItem).then(updatePriceAndDatePerCountryResponse => {
        return updatePriceAndDatePerCountryResponse;
      })
    })

    return Promise.all(dthFunctionCall);
  })
}

function updatePriceAndDatePerCountry(products, options) {
  return new Promise((resolve, reject) => {
    console.log(products);

    products = soap_.without(products, 
      {
        ProductCode : "GOLITE"
      });
      //products = soap_.without(products, 
        //{
          //ProductCode : "GOLITE"
        //});
  

    console.log(products);

    let productCollection = new sql.Table();
    productCollection.columns.add('Currency', sql.VarChar(100));
    productCollection.columns.add('DefaultCurrencyProductPrice', sql.Decimal(18, 2));
    productCollection.columns.add('DefaultCurrencyCode', sql.VarChar(100));
    productCollection.columns.add('HasCustomer', sql.VarChar(100));
    productCollection.columns.add('ProductCode', sql.VarChar(100));
    productCollection.columns.add('ProductDesc', sql.VarChar(100));
    productCollection.columns.add('ProductPrice', sql.Decimal(18, 2));
    productCollection.columns.add('dataSource', sql.VarChar(100));
    productCollection.columns.add('COUNTRYID', sql.Int);

    products.forEach(item => {
      productCollection.rows.add(item.Currency, item.DefaultCurrencyProductPrice, item.DefaultCurrencyCode, item.HasCustomer, item.ProductCode.split(" ")[0], item.ProductDesc, item.ProductPrice, options && options.Country ? options.Country : item.dataSource, options && options.Id ? options.Id : item.id);
    });

    const request = new sql.Request();
    request.input('productCollection', productCollection);
    console.log(productCollection);
    request.execute('[dbo].[UpdateProductDetails]').then(function (result) {
      resolve(result);
    }).catch(function (err) {
      sql.close();
      reject(err);
    });

  })
}