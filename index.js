var soap = require('soap');
var jsforce = require('jsforce');


//parameters to listen to event
var channel = '/event/SendToSAP__e';
var user = 'sfusername@sf.com';
var password = 'SUPERSECRETPWDTOKENCOMBO';
var replayId = -1;
var interfaceName = 'SAPInterface';

//parameters to publish response
var responsechannel = 'SAPResponse__e';


//parameters to call SOAP service
var url = 'https://www.w3schools.com/xml/tempconvert.asmx?WSDL';


//listen to published events
var conn = new jsforce.Connection({});
conn.login(user,password,function(err, userInfo){
    if (err) {return console.log(err);}
    console.log("login successful");
    //get replay Id 
    conn.query("select Id,Last_Replay_Id__c from Integration_Tracker__c where name = '" + interfaceName + "' limit 1", function(err, result){
        if (err){return console.error(err);}
        if (result.records){
            console.log(result.records);
            replayId = parseInt(result.records[0].Last_Replay_Id__c);
            var integTrackerId = result.records[0].Id;

            //create streaming client
            var client = conn.streaming.createClient([
                new jsforce.StreamingExtension.Replay(channel, replayId),
                new jsforce.StreamingExtension.AuthFailure(
                    function() {
                        return process.exit(1);
                    }
                )
            ]);
            console.log("client created" + client);

            var subscription = client.subscribe(channel, function(message){
                console.log(message.event.replayId);
                console.log(message.payload.Message__c);
                var CelciusObj = message.payload.Message__c;
                console.log(typeof(CelciusObj));
               // var requestArgs =  {Celsius: JSON.stringify(CelciusObj.Celcius)};
               // console.log(requestArgs);
                //call webservice with received message
                soap.createClient(url,{endpoint: 'https://www.w3schools.com/xml/tempconvert.asmx'},function(err,client){
                    console.log("client created");
                
                    client.on('soapError', function(err, eid){
                        console.log("REQUEST ERROR", err);
                    });
                    client.on('request', function(xml, eid){
                        console.log("REQUEST SOAP", xml);
                    });
                
                
                    console.log(client.describe().TempConvert.TempConvertSoap.CelsiusToFahrenheit);
                    client.TempConvert.TempConvertSoap.CelsiusToFahrenheit(JSON.parse(message.payload.Message__c),function(err, result){
                
                            var res = result.CelsiusToFahrenheitResult;
                            console.log(res); 
                            
                            conn.sobject(responsechannel).create({ResponseMessage__c : res, RequestReplayId__c : message.event.replayId},function(err,ret){
                                console.log("record created " + ret.success);
                            });

                            conn.sobject("Integration_Tracker__c").update({Id: integTrackerId,Last_Replay_Id__c: message.event.replayId},function(err, rec){
                                if (err || !rec.success) {return console.error(err,rec);}
                                console.log("tracker updated");
                            })
                
                    });
                });       
        
        
            });
        }
    } );
});

console.log("application started");

