using System.Runtime.Serialization;
using System.Collections.Generic;
using System.Web.Script.Serialization;


namespace RIAPP.DataService
{
    [DataContract]
    public class KV 
    {
        [DataMember]
        public int ord
        {
            get;
            set;
        }
        [DataMember]
        public string name
        {
            get;
            set;
        }
    }

    [DataContract]
    public class IncludedResult
    {
        [DataMember]
        public IEnumerable<string> names
        {
            get;
            set;
        }

        [DataMember]
        public IEnumerable<Row> rows
        {
            get;
            set;
        }


        [DataMember]
        public string dbSetName
        {
            get;
            set;
        }

    
        public string ToJSON()
        {
            return SerializationHelper.Serialize(this);
        }
    }

    [DataContract] 
    public class GetDataResult
    {
        /// <summary>
        /// field names returned in the rows
        /// </summary>
        [DataMember]
        public IEnumerable<string> names
        {
            get;
            set;
        }

        [DataMember]
        public IEnumerable<Row> rows
        {
            get;
            set;
        }

        /// <summary>
        /// related child entities (from navigation properties) included in the main result
        /// </summary>
        [DataMember]
        public IEnumerable<IncludedResult> included
        {
            get;
            set;
        }

        [DataMember]
        public int? pageIndex
        {
            get;
            set;
        }

        [DataMember]
        public int? pageCount
        {
            get;
            set;
        }

        [DataMember]
        public string dbSetName
        {
            get;
            set;
        }
       
        /// <summary>
        /// Client can ask to return rows totalcount (in paging scenarios)
        /// </summary>
        [DataMember]
        public int? totalCount
        {
            get;
            set;
        }

        [DataMember]
        public object extraInfo
        {
            get;
            set;
        }

        /// <summary>
        /// Client must first check this field
        /// if all ok, then error is empty
        /// otherwise it contains error message
        /// </summary>
        [DataMember]
        public ErrorInfo error
        {
            get;
            set;
        }

        [DataMember]
        public int fetchSize
        {
            get;
            set;
        }

        public string ToJSON()
        {
            return SerializationHelper.Serialize(this);
        }
    }
   
}
