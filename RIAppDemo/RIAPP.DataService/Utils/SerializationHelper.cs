using System;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;


namespace RIAPP.DataService
{
    public static partial class SerializationHelper
    {
        public static XmlObjectSerializer GetSerializer(Type t)
        {
            DataContractJsonSerializer ser = new DataContractJsonSerializer(t);
            return ser;
        }

        public static object DeSerialize(string str, Type t)
        {
            object obj = null;
            if (!string.IsNullOrEmpty(str))
            {
                var dcser = GetSerializer(t);
                byte[] bytes = System.Text.Encoding.UTF8.GetBytes(str);
                System.IO.MemoryStream stream = new System.IO.MemoryStream(bytes);
                obj = dcser.ReadObject(stream);
            }
            return obj;
        }

        public static string Serialize(object obj, Type t)
        {
            if (obj == null)
                return null;
            var dcser = GetSerializer(t);
            System.IO.MemoryStream stream = new System.IO.MemoryStream();
            dcser.WriteObject(stream, obj);
            stream.Position = 0;
            byte[] bytes = stream.ToArray();
            return System.Text.Encoding.UTF8.GetString(bytes, 0, bytes.Length);
        }

        public static T DeSerialize<T>(string str)
            where T: class, new()
        {
            return (T)DeSerialize(str, typeof(T));
        }

        public static string Serialize<T>(T obj)
            where T:class
        {
            if (obj == null)
                return null;
            return Serialize(obj, typeof(T));
        }
    }
}
